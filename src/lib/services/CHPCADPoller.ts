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
  'Contra Costa': 'CC',
  'Fresno': 'FRE',
  'Los Angeles': 'LA',
  'Orange': 'ORA',
  'Riverside': 'RIV',
  'Sacramento': 'SAC',
  'San Bernardino': 'SBD',
  'San Diego': 'SD',
  'San Francisco': 'SF',
  'San Joaquin': 'SJ',
  'San Mateo': 'SM',
  'Santa Clara': 'SCL',
  'Ventura': 'VEN',
  // Add more counties as needed
};

export class CHPCADPoller {
  private baseUrl = 'https://cad.chp.ca.gov/Traffic.aspx';
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  async fetchIncidentsForCounty(countyName: string, countyCode: string): Promise<CHPIncident[]> {
    try {
      console.log(`Fetching CHP incidents for ${countyName}...`);
      
      // Step 1: Get initial page to capture ASP.NET viewstate
      const initialResponse = await axios.get(this.baseUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000
      });
      
      const $ = cheerio.load(initialResponse.data);
      
      // Extract ASP.NET hidden fields
      const viewState = $('#__VIEWSTATE').val() || '';
      const viewStateGenerator = $('#__VIEWSTATEGENERATOR').val() || '';
      const eventValidation = $('#__EVENTVALIDATION').val() || '';
      
      // Step 2: Submit the form with the county selection
      const postData = new URLSearchParams({
        '__VIEWSTATE': viewState,
        '__VIEWSTATEGENERATOR': viewStateGenerator,
        '__EVENTVALIDATION': eventValidation,
        'ddlComCenter': countyCode,
        'btnSubmit': 'Submit'
      });
      
      const postResponse = await axios.post(this.baseUrl, postData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent
        },
        timeout: 15000
      });
      
      // Step 3: Parse the HTML table
      const incidents = this.parseIncidentsFromHtml(postResponse.data, countyName);
      console.log(`  ✓ Found ${incidents.length} incidents for ${countyName}`);
      return incidents;
      
    } catch (error) {
      console.error(`Failed to fetch CHP data for ${countyName}:`, error);
      return [];
    }
  }

  private parseIncidentsFromHtml(html: string, countyName: string): CHPIncident[] {
    const $ = cheerio.load(html);
    const incidents: CHPIncident[] = [];
    
    // Look for the incident table (common ASP.NET GridView ID)
    const table = $('#GridView1, table:contains("Type")');
    
    if (table.length === 0) {
      return [];
    }
    
    // Parse each row (skip header row)
    table.find('tr').each((index, row) => {
      if (index === 0) return; // Skip header row
      
      const cells = $(row).find('td');
      if (cells.length < 4) return;
      
      const incident: CHPIncident = {
        sourceId: `${countyName}_${Date.now()}_${index}`,
        incidentType: $(cells[0]).text().trim(),
        location: $(cells[1]).text().trim(),
        city: $(cells[2]).text().trim(),
        county: countyName,
        logTime: new Date(),
        details: $(cells[3]).text().trim(),
        status: 'active',
        fetchedAt: new Date(),
      };
      
      if (incident.incidentType) {
        incidents.push(incident);
      }
    });
    
    return incidents;
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
  }

  async pollAll(): Promise<{ success: boolean; stats?: any; error?: string }> {
    if (this.pollingActive) {
      return { success: false, error: 'Polling already in progress' };
    }
    
    this.pollingActive = true;
    const startTime = Date.now();
    
    try {
      console.log(`\n🚦 Starting CHP CAD poll at ${new Date().toISOString()}`);
      
      let allIncidents: CHPIncident[] = [];
      const byCounty: Record<string, number> = {};
      
      // Poll a subset of major counties to avoid rate limiting
      const priorityCounties = ['Los Angeles', 'Orange', 'San Diego', 'Sacramento', 'San Francisco', 'Alameda'];
      
      for (const countyName of priorityCounties) {
        const countyCode = COUNTY_CODES[countyName];
        if (!countyCode) continue;
        
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
      this.lastPollStats = { totalFetched: allIncidents.length, newCount, updatedCount, skippedCount, byCounty, duration };
      
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

  async getStats() {
    const typeCounts = await db
      .select({
        type: chpCadIncidents.incidentType,
        count: sql<number>`COUNT(*)`,
      })
      .from(chpCadIncidents)
      .groupBy(chpCadIncidents.incidentType);
    
    const total = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chpCadIncidents);
    
    return {
      total: total[0]?.count || 0,
      byType: typeCounts,
      lastPoll: this.lastPollTime,
      lastPollStats: this.lastPollStats
    };
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}
