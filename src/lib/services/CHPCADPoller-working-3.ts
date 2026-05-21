// src/lib/services/CHPCADPoller.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '@/lib/db/client';
import { chpCadIncidents, chpCadCenters, apiRequestLogs } from '@/lib/auth/schema';
import { eq, and, sql } from 'drizzle-orm';

export class CHPCADPoller {
  private baseUrl = 'https://cad.chp.ca.gov/Traffic.aspx';
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  async getCenters() {
    // ✅ Using correct Drizzle pattern - build whereClause
    const conditions = [eq(chpCadCenters.isActive, true)];
    const whereClause = and(...conditions);
    
    return await db
      .select()
      .from(chpCadCenters)
      .where(whereClause);
  }

  async fetchIncidentsForCenter(center: { centerCode: string; centerName: string; county: string; id?: number }) {
    try {
      console.log(`  Fetching CHP incidents for ${center.centerName} (${center.centerCode})...`);
      
      // Get initial page for viewstate
      const initialResponse = await axios.get(this.baseUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000
      });
      
      const $ = cheerio.load(initialResponse.data);
      
      const viewState = $('#__VIEWSTATE').val() || '';
      const viewStateGenerator = $('#__VIEWSTATEGENERATOR').val() || '';
      const eventValidation = $('#__EVENTVALIDATION').val() || '';
      
      const formData = new URLSearchParams();
      formData.append('__VIEWSTATE', viewState);
      formData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
      if (eventValidation) formData.append('__EVENTVALIDATION', eventValidation);
      formData.append('ddlComCenter', center.centerCode);
      formData.append('btnSubmit', 'Submit');
      
      const postResponse = await axios.post(this.baseUrl, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent,
        },
        timeout: 15000
      });
      
      const incidents = this.parseIncidentsFromHtml(postResponse.data, center);
      console.log(`    Found ${incidents.length} incidents`);
      return incidents;
      
    } catch (error) {
      console.error(`  Failed to fetch data for ${center.centerName}:`, error);
      return [];
    }
  }

  private parseIncidentsFromHtml(html: string, center: { centerName: string; county: string; id?: number }) {
    const $ = cheerio.load(html);
    const incidents: any[] = [];
    
    // Find the incident table by looking for header text
    let incidentTable: cheerio.Cheerio | undefined;
    const tables = $('table');
    
    tables.each((index, table) => {
      const headerText = $(table).text();
      if (headerText.includes('No.') && headerText.includes('Time') && headerText.includes('Type')) {
        incidentTable = $(table);
        return false;
      }
    });
    
    if (!incidentTable || incidentTable.length === 0) {
      return [];
    }
    
    const rows = incidentTable.find('tbody tr').length ? incidentTable.find('tbody tr') : incidentTable.find('tr');
    const now = new Date();
    
    rows.each((index, row) => {
      if ($(row).find('th').length > 0) return;
      
      const cells = $(row).find('td');
      if (cells.length < 4) return;
      
      const incidentNumber = this.cleanText(cells.eq(1).text());
      const incidentTime = this.cleanText(cells.eq(2).text());
      const incidentType = this.cleanText(cells.eq(3).text());
      const location = this.cleanText(cells.eq(4).text());
      const locationDesc = this.cleanText(cells.eq(5).text());
      const area = this.cleanText(cells.eq(6).text());
      
      if (!incidentType && !location) return;
      
      let fullLocation = location;
      if (locationDesc && locationDesc !== '--') fullLocation += ` (${locationDesc})`;
      if (area && area !== '--') fullLocation += ` - ${area}`;
      
      const logTime = this.parseIncidentTime(incidentTime, now);
      const sourceId = `${center.centerCode}_${incidentNumber || now.getTime()}_${index}`;
      
      incidents.push({
        sourceId,
        centerId: center.id,
        incidentType: incidentType || 'Unknown',
        location: fullLocation || 'Unknown',
        city: area || '',
        county: center.county,
        logTime: logTime,
        details: `No. ${incidentNumber} - ${incidentType}`,
        status: 'active',
        fetchedAt: now,
      });
    });
    
    return incidents;
  }

  private parseIncidentTime(timeStr: string, today: Date): Date {
    if (!timeStr) return today;
    try {
      const [time, modifier] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours !== 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      const date = new Date(today);
      date.setHours(hours, minutes || 0, 0, 0);
      return date;
    } catch {
      return today;
    }
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

  private async upsertIncident(incident: any): Promise<'new' | 'updated' | 'skipped'> {
    try {
      // ✅ Using proper Drizzle pattern
      const whereClause = eq(chpCadIncidents.sourceId, incident.sourceId);
      
      const existing = await db
        .select()
        .from(chpCadIncidents)
        .where(whereClause)
        .limit(1);
      
      if (existing.length > 0) {
        if (existing[0].status !== incident.status) {
          const updateWhere = eq(chpCadIncidents.sourceId, incident.sourceId);
          await db
            .update(chpCadIncidents)
            .set({ ...incident, updatedAt: new Date() })
            .where(updateWhere);
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
      
      const centers = await this.getCenters();
      console.log(`  Polling ${centers.length} communications centers`);
      
      let allIncidents: any[] = [];
      const byCenter: Record<string, number> = {};
      
      for (const center of centers) {
        const incidents = await this.fetchIncidentsForCenter(center);
        allIncidents = [...allIncidents, ...incidents];
        byCenter[center.centerName] = incidents.length;
        
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
        byCenter, 
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

  async getStats() {
    try {
      // ✅ Using proper Drizzle pattern for stats
      const total = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(chpCadIncidents);
      
      const byCenterStats = await db
        .select({
          centerName: chpCadCenters.centerName,
          count: sql<number>`COUNT(${chpCadIncidents.id})`,
        })
        .from(chpCadIncidents)
        .leftJoin(chpCadCenters, eq(chpCadIncidents.centerId, chpCadCenters.id))
        .groupBy(chpCadCenters.centerName);
      
      return {
        total: Number(total[0]?.count || 0),
        byCenter: byCenterStats,
        lastPoll: this.lastPollTime,
        lastPollStats: this.lastPollStats
      };
    } catch (error) {
      console.error('Error getting CHP CAD stats:', error);
      return { total: 0, byCenter: [], lastPoll: this.lastPollTime, lastPollStats: this.lastPollStats };
    }
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}