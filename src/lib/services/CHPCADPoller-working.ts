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

// CHP Communication Centers (Counties) with their codes
const COUNTY_CODES: Record<string, string> = {
  'Alameda': 'ALAM',
  'Amador': 'AMA',
  'Butte': 'BUTT',
  'Calaveras': 'CALV',
  'Colusa': 'COLU',
  'Contra Costa': 'CC',
  'Del Norte': 'DN',
  'El Dorado': 'ED',
  'Fresno': 'FRE',
  'Glenn': 'GLE',
  'Humboldt': 'HUM',
  'Imperial': 'IMP',
  'Inyo': 'INY',
  'Kern': 'KERN',
  'Kings': 'KING',
  'Lake': 'LAKE',
  'Lassen': 'LASS',
  'Los Angeles': 'LA',
  'Madera': 'MAD',
  'Marin': 'MRN',
  'Mariposa': 'MP',
  'Mendocino': 'MEND',
  'Merced': 'MERC',
  'Modoc': 'MOD',
  'Mono': 'MONO',
  'Monterey': 'MTY',
  'Napa': 'NAPA',
  'Nevada': 'NEV',
  'Orange': 'ORA',
  'Placer': 'PLAC',
  'Plumas': 'PLU',
  'Riverside': 'RIV',
  'Sacramento': 'SAC',
  'San Benito': 'SBT',
  'San Bernardino': 'SBD',
  'San Diego': 'SD',
  'San Francisco': 'SF',
  'San Joaquin': 'SJ',
  'San Luis Obispo': 'SLO',
  'San Mateo': 'SM',
  'Santa Barbara': 'SB',
  'Santa Clara': 'SCL',
  'Santa Cruz': 'SCZ',
  'Shasta': 'SHA',
  'Sierra': 'SIE',
  'Siskiyou': 'SIS',
  'Solano': 'SOL',
  'Sonoma': 'SON',
  'Stanislaus': 'STA',
  'Sutter': 'SUT',
  'Tehama': 'TEH',
  'Trinity': 'TRI',
  'Tulare': 'TUL',
  'Tuolumne': 'TUO',
  'Ventura': 'VEN',
  'Yolo': 'YOLO',
  'Yuba': 'YUBA'
};

export class CHPCADPoller {
  private baseUrl = 'https://cad.chp.ca.gov/Traffic.aspx';
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  async fetchIncidentsForCounty(countyName: string, countyCode: string): Promise<CHPIncident[]> {
    try {
      console.log(`  Fetching CHP incidents for ${countyName}...`);
      
      // First, get the initial page to capture ASP.NET viewstate
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
      
      // Parse the response HTML
      const incidents = this.parseIncidentsFromHtml(postResponse.data, countyName);
      console.log(`    Found ${incidents.length} incidents`);
      return incidents;
      
    } catch (error) {
      console.error(`  Failed to fetch data for ${countyName}:`, error);
      return [];
    }
  }

  private parseIncidentsFromHtml(html: string, countyName: string): CHPIncident[] {
    const $ = cheerio.load(html);
    const incidents: CHPIncident[] = [];
    
    // Look for the incident table - common patterns in CHP CAD page
    // Try multiple possible table selectors
    let table = $('#GridView1');
    if (table.length === 0) {
      table = $('#grdIncidents');
    }
    if (table.length === 0) {
      table = $('table:contains("Type")');
    }
    if (table.length === 0) {
      table = $('table[id*=GridView]');
    }
    
    if (table.length === 0) {
      return [];
    }
    
    // Find all rows in the table body
    const rows = table.find('tbody tr');
    if (rows.length === 0) {
      // Try direct rows if no tbody
      const directRows = table.find('tr');
      if (directRows.length > 0) {
        return this.processRows(directRows, countyName);
      }
    }
    
    return this.processRows(rows, countyName);
  }

  private processRows(rows: any, countyName: string): CHPIncident[] {
    const incidents: CHPIncident[] = [];
    const now = new Date();
    
    rows.each((index: number, row: any) => {
      const cells = (row as cheerio.Element).children.filter((child: any) => child.type === 'tag' && child.name === 'td');
      
      if (cells.length < 4) return;
      
      // Skip header row (look for th instead of td)
      const firstCellText = (cells[0] as any).children?.[0]?.data?.trim() || '';
      if (firstCellText.toLowerCase() === 'type') return;
      
      const incidentType = this.cleanText((cells[0] as any).children?.[0]?.data || '');
      const location = this.cleanText((cells[1] as any).children?.[0]?.data || '');
      const city = this.cleanText((cells[2] as any).children?.[0]?.data || '');
      const details = this.cleanText((cells[3] as any).children?.[0]?.data || '');
      
      if (!incidentType && !location) return;
      
      const sourceId = `${countyName}_${now.getTime()}_${index}`;
      
      incidents.push({
        sourceId,
        incidentType: incidentType || 'Unknown',
        location: location || 'Unknown',
        city: city || '',
        county: countyName,
        logTime: now,
        details: details || '',
        status: 'active',
        fetchedAt: now,
      });
    });
    
    return incidents;
  }

  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private async logApiRequest(logData: {
    endpoint: string;
    responseTimeMs: number;
    statusCode?: number;
    success: boolean;
    recordsFetched?: number;
    errorMessage?: string;
  }) {
    try {
      await db.insert(apiRequestLogs).values({
        endpoint: logData.endpoint,
        responseTimeMs: logData.responseTimeMs,
        statusCode: logData.statusCode,
        success: logData.success,
        recordsFetched: logData.recordsFetched || 0,
        errorMessage: logData.errorMessage,
      });
    } catch (error) {
      console.error('Failed to log API request:', error);
    }
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
      
      // Poll a subset of major counties to avoid rate limiting
      const priorityCounties = [
        'Los Angeles', 'Orange', 'San Diego', 'Sacramento', 
        'San Francisco', 'Alameda', 'Riverside', 'San Bernardino'
      ];
      
      let allIncidents: CHPIncident[] = [];
      const byCounty: Record<string, number> = {};
      
      for (const countyName of priorityCounties) {
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
      
      console.log(`✅ CHP CAD Poll complete: ${allIncidents.length} incidents, ${newCount} new, ${updatedCount} updated`);
      
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

  // src/lib/services/CHPCADPoller.ts - Add getStats method
  // ... (keep all your existing code, just add/update the getStats method)

  async getStats() {
    try {
      const typeCounts = await db
        .select({
          type: chpCadIncidents.incidentType,
          count: sql<number>`COUNT(*)`,
        })
        .from(chpCadIncidents)
        .groupBy(chpCadIncidents.incidentType)
        .orderBy(sql`count DESC`)
        .limit(10);
      
      const countyCounts = await db
        .select({
          county: chpCadIncidents.county,
          count: sql<number>`COUNT(*)`,
        })
        .from(chpCadIncidents)
        .groupBy(chpCadIncidents.county)
        .orderBy(sql`count DESC`);
      
      const total = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(chpCadIncidents);
      
      return {
        total: Number(total[0]?.count || 0),
        byType: typeCounts.map(t => ({ type: t.type, count: Number(t.count) })),
        byCounty: countyCounts.map(c => ({ county: c.county, count: Number(c.count) })),
        lastPoll: this.lastPollTime,
        lastPollStats: this.lastPollStats
      };
    } catch (error) {
      console.error('Error getting CHP CAD stats:', error);
      return {
        total: 0,
        byType: [],
        byCounty: [],
        lastPoll: this.lastPollTime,
        lastPollStats: this.lastPollStats
      };
    }
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}