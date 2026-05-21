// src/lib/services/CHPCADPoller.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '@/lib/db/client';
import { chpCadIncidents, apiRequestLogs } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

interface CHPIncident {
  sourceId: string;
  incidentType: string;
  location: string;
  city: string;
  county: string;
  logTime: Date;
  details: string;
  status: string;
  fetchedAt: Date;
}

// Mapping of county names to their URL parameter codes
const COUNTY_CODES: Record<string, string> = {
//   'Alameda': 'ALAM',
  'Ukiah': 'UKI', // <-- Added Ukiah
  'Mendocino': 'MEN', // <-- Added Mendocino
  'Eureka': 'MEN', // <-- Added Eureka
//   'Los Angeles': 'LA',
//   'Orange': 'ORA',
  'Sacramento': 'SAC',
//   'San Diego': 'SD',
  'San Francisco': 'SF',
//   'San Jose': 'SJ',
  // Add other counties as needed...
};

export class CHPCADPoller {
  private baseUrl = 'https://cad.chp.ca.gov/Traffic.aspx';
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  async fetchIncidentsForCounty(countyName: string, countyCode: string): Promise<CHPIncident[]> {
    try {
      console.log(`  Fetching CHP incidents for ${countyName} (${countyCode})...`);
      
      // Get the initial page to capture the ASP.NET viewstate
      const initialResponse = await axios.get(this.baseUrl, {
        headers: { 
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 15000
      });
      
      const $ = cheerio.load(initialResponse.data);
      
      // Extract ASP.NET hidden fields
      const viewState = $('#__VIEWSTATE').val() || '';
      const viewStateGenerator = $('#__VIEWSTATEGENERATOR').val() || '';
      const eventValidation = $('#__EVENTVALIDATION').val() || '';
      
      // Build form data
      const formData = new URLSearchParams();
      formData.append('__VIEWSTATE', viewState);
      formData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
      if (eventValidation) formData.append('__EVENTVALIDATION', eventValidation);
      formData.append('ddlComCenter', countyCode);
      formData.append('btnSubmit', 'Submit');
      
      // Submit the form
      const postResponse = await axios.post(this.baseUrl, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent,
          'Referer': this.baseUrl,
          'Origin': 'https://cad.chp.ca.gov'
        },
        timeout: 15000
      });
      
      // Parse the response HTML using the robust parser
      const incidents = this.parseIncidentsFromHtmlRobust(postResponse.data, countyName);
      console.log(`    Found ${incidents.length} incidents`);
      return incidents;
      
    } catch (error) {
      console.error(`  Failed to fetch data for ${countyName}:`, error);
      return [];
    }
  }

  /**
   * Robust parser that looks for the standard incident table based on headers.
   */
  private parseIncidentsFromHtmlRobust(html: string, countyName: string): CHPIncident[] {
    const $ = cheerio.load(html);
    const incidents: CHPIncident[] = [];

    // Find the table that contains the standard incident headers (No., Time, Type, etc.)
    let incidentTable: cheerio.Cheerio | undefined;
    const tables = $('table');
    
    tables.each((index, table) => {
      const headerText = $(table).text();
      if (headerText.includes('No.') && headerText.includes('Time') && headerText.includes('Type') && headerText.includes('Location')) {
        incidentTable = $(table);
        return false; // break the loop
      }
    });

    if (!incidentTable || incidentTable.length === 0) {
      console.warn(`  Could not find incident table for ${countyName}`);
      return [];
    }

    // Find all rows in the table body, or directly in the table if no tbody
    const rows = incidentTable.find('tbody tr').length ? incidentTable.find('tbody tr') : incidentTable.find('tr');
    if (rows.length === 0) {
      return [];
    }

    const now = new Date();
    
    rows.each((index, row) => {
      // Skip the header row (which contains th elements)
      const headerRow = $(row).find('th').length > 0;
      if (headerRow) return;

      const cells = $(row).find('td');
      if (cells.length < 4) return;

      // Map columns based on your example:
      // Column 0: Details link (often empty or an image)
      // Column 1: No. (incident number)
      // Column 2: Time
      // Column 3: Type
      // Column 4: Location
      // Column 5: Location Desc.
      // Column 6: Area
      
      const incidentNumber = this.cleanText(cells.eq(1).text());
      const incidentTime = this.cleanText(cells.eq(2).text());
      const incidentType = this.cleanText(cells.eq(3).text());
      const location = this.cleanText(cells.eq(4).text());
      const locationDesc = this.cleanText(cells.eq(5).text());
      const area = this.cleanText(cells.eq(6).text());

      if (!incidentType && !location) return;

      // Construct a human-readable location string
      let fullLocation = location;
      if (locationDesc && locationDesc !== '--' && locationDesc !== '') {
        fullLocation += ` (${locationDesc})`;
      }
      if (area && area !== '--' && area !== '') {
        fullLocation += ` - ${area}`;
      }
      
      // Parse the time to create a logTime
      const logTime = this.parseIncidentTime(incidentTime, now);
      
      const sourceId = `${countyName}_${incidentNumber || now.getTime()}_${index}`;
      
      incidents.push({
        sourceId,
        incidentType: incidentType || 'Unknown',
        location: fullLocation || 'Unknown',
        city: area || '',
        county: countyName,
        logTime: logTime,
        details: `No. ${incidentNumber} - ${incidentType}${locationDesc ? ` (${locationDesc})` : ''}`,
        status: 'active',
        fetchedAt: now,
      });
    });
    
    return incidents;
  }

  /**
   * Parses a time string like "8:29 AM" into a full Date object for today.
   */
  private parseIncidentTime(timeStr: string, today: Date): Date {
    if (!timeStr || timeStr === '') return today;
    try {
      const [time, modifier] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours !== 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      const date = new Date(today);
      date.setHours(hours, minutes || 0, 0, 0);
      return date;
    } catch (e) {
      return today;
    }
  }

  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private async upsertIncident(incident: CHPIncident): Promise<'new' | 'updated' | 'skipped'> {
    try {
      const existing = await db
        .select()
        .from(chpCadIncidents)
        .where(eq(chpCadIncidents.sourceId, incident.sourceId))
        .limit(1);
      
      if (existing.length > 0) {
        // Update if status changed
        if (existing[0].status !== incident.status) {
          await db
            .update(chpCadIncidents)
            .set({ ...incident, updatedAt: new Date() })
            .where(eq(chpCadIncidents.sourceId, incident.sourceId));
          return 'updated';
        }
        return 'skipped';
      } else {
        await db.insert(chpCadIncidents).values(incident);
        return 'new';
      }
    } catch (error) {
      console.error(`Error upserting incident ${incident.sourceId}:`, error);
      return 'skipped';
    }
  }

  async pollAll(): Promise<{ success: boolean; stats?: any; error?: string }> {
    if (this.pollingActive) {
      return { success: false, error: 'Polling already in progress' };
    }
    
    this.pollingActive = true;
    const startTime = Date.now();
    
    try {
      console.log(`\n🚦 Starting CHP CAD poll at ${new Date().toISOString()}`);
      
      const countiesToPoll = ['Ukiah']; // Start with Ukiah, then add others
      
      let allIncidents: CHPIncident[] = [];
      const byCounty: Record<string, number> = {};
      
      for (const countyName of countiesToPoll) {
        const countyCode = COUNTY_CODES[countyName];
        if (!countyCode) {
          console.log(`  No county code for ${countyName}, skipping`);
          continue;
        }
        
        const incidents = await this.fetchIncidentsForCounty(countyName, countyCode);
        allIncidents = [...allIncidents, ...incidents];
        byCounty[countyName] = incidents.length;
        
        // Be respectful: add delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      
      for (const incident of allIncidents) {
        const result = await this.upsertIncident(incident);
        if (result === 'new') newCount++;
        else if (result === 'updated') updatedCount++;
        else skippedCount++;
      }
      
      const duration = Date.now() - startTime;
      this.lastPollTime = new Date();
      this.lastPollStats = { 
        totalFetched: allIncidents.length, 
        newCount, 
        updatedCount, 
        skippedCount, 
        byCounty, 
        duration 
      };
      
      console.log(`✅ CHP CAD Poll complete: ${allIncidents.length} incidents, ${newCount} new`);
      
      return {
        success: true,
        stats: this.lastPollStats,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('CHP CAD Polling error:', error);
      return { success: false, error: String(error) };
    } finally {
      this.pollingActive = false;
    }
  }

  // ... (keep your existing getStats and other helper methods)
}