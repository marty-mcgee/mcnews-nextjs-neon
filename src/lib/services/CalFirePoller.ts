// src/lib/services/CalFirePoller.ts
import { db } from '@/lib/db/client';
import { calfireIncidents } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

// Northern California counties to monitor
const NORTHERN_CA_COUNTIES = [
  'Mendocino', 'Humboldt', 'Lake', 'Sonoma', 'Napa', 'Marin',
  'Solano', 'Contra Costa', 'Alameda', 'Santa Clara', 'San Mateo',
  'San Francisco', 'Sacramento', 'Yolo', 'Placer', 'El Dorado',
  'Butte', 'Tehama', 'Shasta', 'Siskiyou', 'Trinity', 'Del Norte',
  'Modoc', 'Lassen', 'Plumas', 'Sierra', 'Nevada', 'Colusa',
  'Glenn', 'Sutter', 'Yuba', 'Amador', 'Calaveras', 'Tuolumne',
  'Mariposa', 'Merced', 'Stanislaus', 'San Joaquin',
  // for testing, use Souther California Counties, as well
  'Riverside', 'Santa Barbara', 'Ventura', 'Los Angeles'
];

export class CalFirePoller {
  private baseUrl = 'https://incidents.fire.ca.gov/umbraco/api/IncidentApi/List';
  
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  /**
   * Fetch incidents from CalFire API
   * @param includeInactive - If true, fetch both active and inactive incidents
   */
  private async fetchIncidents(includeInactive: boolean = false): Promise<any[]> {
    const url = `${this.baseUrl}?inactive=${includeInactive}`;
    
    try {
      console.log(`[${new Date().toISOString()}] Fetching CalFire incidents...`);
      console.log(`  URL: ${url}`);
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'MCNews-CalFire-Poller/1.0' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const incidents = Array.isArray(data) ? data : [];
      
      console.log(`  Total incidents from API: ${incidents.length}`);
      
      // Filter for Northern California counties
      const northernIncidents = incidents.filter((incident: any) => {
        const county = incident.County;
        return NORTHERN_CA_COUNTIES.includes(county);
      });
      
      console.log(`  Northern California incidents: ${northernIncidents.length}`);
      
      return northernIncidents;
      
    } catch (error) {
      console.error('✗ CalFire API failed:', error);
      return [];
    }
  }

  /**
   * Extract Northern California counties from all incidents
   */
  private isNorthernCalifornia(county: string): boolean {
    return NORTHERN_CA_COUNTIES.includes(county);
  }

  /**
   * Upsert a single incident
   */
  private async upsertIncident(incident: any): Promise<'new' | 'updated' | 'closed'> {
    const uniqueId = incident.UniqueId;
    
    if (!uniqueId) {
      console.log('  Skipping incident with no UniqueId');
      return 'skipped';
    }
    
    const existing = await db
      .select()
      .from(calfireIncidents)
      .where(eq(calfireIncidents.uniqueId, uniqueId))
      .limit(1);
    
    const incidentData = {
      uniqueId: uniqueId,
      name: incident.Name || 'Unknown',
      type: incident.Type || 'Wildfire',
      status: incident.Final ? 'final' : 'active',
      county: incident.County,
      location: incident.Location,
      latitude: incident.Latitude ? parseFloat(incident.Latitude) : null,
      longitude: incident.Longitude ? parseFloat(incident.Longitude) : null,
      acresBurned: incident.AcresBurned ? parseFloat(incident.AcresBurned) : null,
      percentContained: incident.PercentContained ? parseFloat(incident.PercentContained) : null,
      startedAt: incident.Started ? new Date(incident.Started) : null,
      updatedAt: incident.Updated ? new Date(incident.Updated) : null,
      extinguishedAt: incident.ExtinguishedDate ? new Date(incident.ExtinguishedDate) : null,
      adminUnit: incident.AdminUnit,
      url: incident.Url,
      isActive: incident.IsActive === true,
      isCalFireIncident: incident.CalFireIncident === true,
      rawData: incident,
      lastSeen: new Date(),
    };
    
    try {
      if (existing.length > 0) {
        // Check if incident was active but now extinguished
        const wasActive = existing[0].isActive;
        const isNowActive = incident.IsActive === true;
        
        await db.update(calfireIncidents).set({
          ...incidentData,
          lastSeen: new Date(),
        }).where(eq(calfireIncidents.uniqueId, uniqueId));
        
        // Return 'closed' if status changed from active to inactive
        if (wasActive && !isNowActive) {
          return 'closed';
        }
        return 'updated';
      } else {
        await db.insert(calfireIncidents).values(incidentData);
        return 'new';
      }
    } catch (error) {
      console.error(`Error upserting incident ${uniqueId}:`, error);
      return 'skipped';
    }
  }

  /**
   * Poll all active incidents
   */
  async pollActive(): Promise<{ success: boolean; stats?: any; error?: string }> {
    if (this.pollingActive) {
      return { success: false, error: 'Polling already in progress' };
    }
    
    this.pollingActive = true;
    const startTime = Date.now();
    
    try {
      console.log(`\n🔥 Starting CalFire Active Incidents poll at ${new Date().toISOString()}`);
      
      const incidents = await this.fetchIncidents(false);
      
      let newCount = 0;
      let updatedCount = 0;
      let closedCount = 0;
      let skippedCount = 0;
      
      for (const incident of incidents) {
        const result = await this.upsertIncident(incident);
        if (result === 'new') newCount++;
        else if (result === 'updated') updatedCount++;
        else if (result === 'closed') closedCount++;
        else skippedCount++;
      }
      
      const duration = Date.now() - startTime;
      this.lastPollTime = new Date();
      this.lastPollStats = { 
        totalFetched: incidents.length, 
        newCount, 
        updatedCount,
        closedCount,
        skippedCount,
        duration,
        type: 'active'
      };
      
      console.log(`✅ CalFire Active Poll complete:`);
      console.log(`  ${incidents.length} active incidents, ${newCount} new, ${updatedCount} updated, ${closedCount} closed`);
      console.log(`  Duration: ${duration}ms`);
      
      return {
        success: true,
        stats: this.lastPollStats,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('CalFire Polling error:', error);
      return { success: false, error: String(error) };
    } finally {
      this.pollingActive = false;
    }
  }

  /**
   * Poll all incidents (including inactive) - for backfill
   */
  async pollAll(options?: { includeInactive?: boolean }): Promise<{ success: boolean; stats?: any; error?: string }> {
    if (this.pollingActive) {
      return { success: false, error: 'Polling already in progress' };
    }
    
    this.pollingActive = true;
    const startTime = Date.now();
    const includeInactive = options?.includeInactive || false;
    
    try {
      console.log(`\n🔥 Starting CalFire ${includeInactive ? 'Full' : 'Incident'} poll at ${new Date().toISOString()}`);
      
      const incidents = await this.fetchIncidents(includeInactive);
      
      let newCount = 0;
      let updatedCount = 0;
      let closedCount = 0;
      let skippedCount = 0;
      
      for (const incident of incidents) {
        const result = await this.upsertIncident(incident);
        if (result === 'new') newCount++;
        else if (result === 'updated') updatedCount++;
        else if (result === 'closed') closedCount++;
        else skippedCount++;
      }
      
      const duration = Date.now() - startTime;
      this.lastPollTime = new Date();
      this.lastPollStats = { 
        totalFetched: incidents.length, 
        newCount, 
        updatedCount,
        closedCount,
        skippedCount,
        duration,
        type: includeInactive ? 'full' : 'active'
      };
      
      console.log(`✅ CalFire Poll complete:`);
      console.log(`  ${incidents.length} incidents, ${newCount} new, ${updatedCount} updated, ${closedCount} closed`);
      console.log(`  Duration: ${duration}ms`);
      
      return {
        success: true,
        stats: this.lastPollStats,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('CalFire Polling error:', error);
      return { success: false, error: String(error) };
    } finally {
      this.pollingActive = false;
    }
  }

  async getStats() {
    const total = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(calfireIncidents);
    
    const active = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(calfireIncidents)
      .where(eq(calfireIncidents.isActive, true));
    
    const byCounty = await db
      .select({
        county: calfireIncidents.county,
        count: sql<number>`COUNT(*)`,
      })
      .from(calfireIncidents)
      .where(eq(calfireIncidents.isActive, true))
      .groupBy(calfireIncidents.county)
      .orderBy(sql`count DESC`);
    
    const totalAcres = await db
      .select({ sum: sql<number>`SUM(acres_burned)` })
      .from(calfireIncidents)
      .where(eq(calfireIncidents.isActive, true));
    
    return {
      total: total[0]?.count || 0,
      active: active[0]?.count || 0,
      byCounty: byCounty,
      totalActiveAcres: totalAcres[0]?.sum || 0,
      lastPoll: this.lastPollTime,
      lastPollStats: this.lastPollStats
    };
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}