// src/lib/services/CHPCADPoller.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '@/lib/db/client';
import { chpCadIncidents, chpCadCenters } from '@/lib/auth/schema';
import { eq, and } from 'drizzle-orm';

const CENTERS_LIST = [
  { code: 'UKCC', name: 'Ukiah', county: 'Mendocino' },
  { code: 'HMCC', name: 'Humboldt', county: 'Humboldt' },
  // { code: 'SACC', name: 'Sacramento', county: 'Sacramento' },
  // { code: 'LACC', name: 'Los Angeles', county: 'Los Angeles' },
  // { code: 'GGCC', name: 'Golden Gate', county: 'San Francisco' },
  // { code: 'SKCCSTCC', name: 'Stockton', county: 'San Joaquin' },
  // { code: 'OCCC', name: 'Orange', county: 'Orange' },
  // { code: 'FRCC', name: 'Fresno', county: 'Fresno' },
  // { code: 'BFCC', name: 'Bakersfield', county: 'Kern' },
];

export class CHPCADPoller {
  private baseUrl = 'https://cad.chp.ca.gov/Traffic.aspx';
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  async pollAll() {
    console.log(`\n🚦 Starting CHP CAD poll at ${new Date().toISOString()}`);
    
    let allIncidents: any[] = [];
    let totalNew = 0;
    
    for (const center of CENTERS_LIST) {
      const incidents = await this.fetchIncidentsForCenter(center);
      console.log(`  ${center.name}: ${incidents.length} incidents found`);
      allIncidents = [...allIncidents, ...incidents];
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    for (const incident of allIncidents) {
      const conditions = [eq(chpCadIncidents.sourceId, incident.sourceId)];
      const whereClause = and(...conditions);
      
      const existing = await db
        .select()
        .from(chpCadIncidents)
        .where(whereClause)
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(chpCadIncidents).values(incident);
        totalNew++;
      }
    }
    
    console.log(`✅ CHP CAD Poll complete: ${allIncidents.length} total, ${totalNew} new`);
    
    return { success: true, stats: { totalFetched: allIncidents.length, newCount: totalNew } };
  }

  private async fetchIncidentsForCenter(center: { code: string; name: string; county: string }) {
    try {
      console.log(`  Fetching ${center.name} (${center.code})...`);
      
      // Get center ID from database
      const centerConditions = [eq(chpCadCenters.centerCode, center.code)];
      const centerWhere = and(...centerConditions);
      
      const centerRecord = await db
        .select({ id: chpCadCenters.id })
        .from(chpCadCenters)
        .where(centerWhere)
        .limit(1);
      
      const centerId = centerRecord[0]?.id || null;
      
      // Get initial page to capture viewstate
      const initialResponse = await axios.get(this.baseUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000
      });
      
      const $init = cheerio.load(initialResponse.data);
      
      const viewState = $init('#__VIEWSTATE').val() || '';
      const viewStateGenerator = $init('#__VIEWSTATEGENERATOR').val() || '';
      const eventValidation = $init('#__EVENTVALIDATION').val() || '';
      
      const formData = new URLSearchParams();
      formData.append('__VIEWSTATE', viewState);
      formData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
      if (eventValidation) formData.append('__EVENTVALIDATION', eventValidation);
      formData.append('ddlComCenter', center.code);
      formData.append('btnCCGo', 'OK');
      
      const response = await axios.post(this.baseUrl, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent,
        },
        timeout: 15000
      });
      
      const incidents = this.parseIncidentsFromHtml(response.data, center, centerId);
      return incidents;
      
    } catch (error) {
      console.error(`  Error fetching ${center.name}:`, error);
      return [];
    }
  }

  private parseIncidentsFromHtml(html: string, center: any, centerId: number | null) {
    const $ = cheerio.load(html);
    const incidents: any[] = [];
    
    // Find the table by its ID
    const incidentTable = $('#gvIncidents');
    
    if (!incidentTable || incidentTable.length === 0) {
      console.log(`    No incident table found for ${center.name}`);
      return [];
    }
    
    // Get all data rows
    const rows = incidentTable.find('tr.gvRow, tr.gvAltRow');
    const now = new Date();
    
    rows.each((index, row) => {
      const cells = $(row).find('td');
      if (cells.length < 7) return;
      
      const incidentNumber = cells.eq(1).text().trim();
      const incidentTime = cells.eq(2).text().trim();
      const incidentType = cells.eq(3).text().trim();
      const location = cells.eq(4).text().trim();
      const locationDesc = cells.eq(5).text().trim();
      const area = cells.eq(6).text().trim();
      
      if (!incidentType && !location) return;
      
      // Build full location string
      let fullLocation = location;
      if (locationDesc && locationDesc !== '&nbsp;' && locationDesc !== '') {
        fullLocation += ` (${locationDesc})`;
      }
      if (area && area !== '&nbsp;' && area !== '') {
        fullLocation += ` - ${area}`;
      }
      
      // Parse time
      let logTime = new Date(now);
      if (incidentTime) {
        try {
          const [time, modifier] = incidentTime.split(' ');
          let [hours, minutes] = time.split(':').map(Number);
          if (modifier === 'PM' && hours !== 12) hours += 12;
          if (modifier === 'AM' && hours === 12) hours = 0;
          logTime.setHours(hours, minutes || 0, 0, 0);
        } catch (e) {
          // Keep default time
        }
      }
      
      incidents.push({
        sourceId: `${center.code}_${incidentNumber || now.getTime()}_${index}`,
        centerId: centerId,
        incidentType: incidentType || 'Unknown',
        location: fullLocation || location || 'Unknown',
        city: area || '',
        county: center.county,
        logTime: logTime,
        details: `${incidentType} at ${location}`,
        status: 'active',
        fetchedAt: now,
      });
    });
    
    console.log(`    Parsed ${incidents.length} incidents for ${center.name}`);
    return incidents;
  }
}