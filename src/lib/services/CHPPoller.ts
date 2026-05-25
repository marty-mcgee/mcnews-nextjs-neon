// src/lib/services/CHPPoller.ts
import { db } from '@/lib/db/client';
import { chpCollisions } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

export class CHPPoller {
  private resourceId = 'b8ce0ca4-b4e9-490d-b4d1-1f4ec48cbefb';
  private baseUrl = 'https://data.ca.gov/api/3/action/datastore_search';
  
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  // Local counties: Humboldt (12) and Mendocino (23)
  private readonly LOCAL_COUNTIES = [12, 23];

  private isLocalCounty(countyCode: number): boolean {
    return this.LOCAL_COUNTIES.includes(countyCode);
  }

  async fetchCollisions(options: { 
    limit?: number; 
    startDate?: string; 
    endDate?: string;
  } = {}) {
    const { limit = 100, startDate, endDate } = options;
    
    try {
      const url = `https://data.ca.gov/api/3/action/datastore_search?resource_id=${this.resourceId}&limit=${limit}&sort=Crash%20Date%20Time%20desc`;
      
      console.log(`[${new Date().toISOString()}] Fetching CHP collision data...`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      let records = data.result?.records || [];
      const total = data.result?.total || 0;
      const success = data.success === true;
      
      // Filter by date range and local county
      if (startDate || endDate) {
        const originalCount = records.length;
        records = records.filter((record: any) => {
          // Date filter
          const crashDate = record['Crash Date Time'];
          if (!crashDate) return false;
          const crashDateObj = new Date(crashDate);
          
          if (startDate && new Date(startDate) > crashDateObj) return false;
          if (endDate && new Date(endDate) < crashDateObj) return false;
          
          // County filter - only Humboldt (12) or Mendocino (23)
          const countyCode = record['County Code'];
          if (!this.isLocalCounty(countyCode)) return false;
          
          return true;
        });
        console.log(`  Date & county filter applied: ${originalCount} -> ${records.length} records`);
      }
      
      console.log(`  ✓ Fetched ${records.length} local records (total available: ${total})`);
      
      return { success, records, total };
      
    } catch (error) {
      console.error('✗ CHP API failed:', error);
      return { success: false, records: [], total: 0 };
    }
  }

  private async upsertCollision(record: any): Promise<'new' | 'updated' | 'skipped'> {
    const caseId = record['Report Number'];
    
    if (!caseId) {
      return 'skipped';
    }
    
    let collisionDate: Date | null = null;
    let collisionYear: number | null = null;
    if (record['Crash Date Time']) {
      collisionDate = new Date(record['Crash Date Time']);
      collisionYear = collisionDate.getFullYear();
    }
    
    const severity = this.mapSeverity(record['Collision Type Description']);
    
    const collisionData = {
      caseId: caseId,
      collisionDate: collisionDate,
      collisionYear: collisionYear,
      severity: severity,
      county: record['County Code'] ? this.mapCountyCodeToName(record['County Code']) : null,
      city: record['City Name'],
      location: this.buildLocation(record),
      latitude: record['Latitude'] ? parseFloat(record['Latitude']) : null,
      longitude: record['Longitude'] ? parseFloat(record['Longitude']) : null,
      primaryFactor: record['Primary Collision Factor Violation'],
      weather: record['Weather 1'],
      lighting: record['LightingDescription'],
      injuries: record['NumberInjured'] || 0,
      fatalities: record['NumberKilled'] || 0,
      rawData: record,
      lastSeen: new Date(),
    };
    
    try {
      const existing = await db
        .select()
        .from(chpCollisions)
        .where(eq(chpCollisions.caseId, caseId))
        .limit(1);
      
      if (existing.length > 0) {
        return 'skipped';
      } else {
        await db.insert(chpCollisions).values(collisionData);
        return 'new';
      }
    } catch (error) {
      console.error(`Error upserting collision ${caseId}:`, error);
      return 'skipped';
    }
  }

  private mapSeverity(collisionType: string): string {
    if (!collisionType) return 'Unknown';
    const type = collisionType.toLowerCase();
    if (type.includes('fatal')) return 'Fatal';
    if (type.includes('injury')) return 'Injury';
    return 'Property Damage';
  }

  private buildLocation(record: any): string {
    const parts = [];
    if (record['Primary Road']) parts.push(record['Primary Road']);
    if (record['Secondary Road'] && record['Secondary Road'] !== 'NULL') parts.push(`& ${record['Secondary Road']}`);
    if (record['City Name']) parts.push(`in ${record['City Name']}`);
    return parts.join(' ') || 'Unknown location';
  }

  private mapCountyCodeToName(countyCode: number): string | null {
    const countyMap: Record<number, string> = {
      1: 'Alameda', 2: 'Alpine', 3: 'Amador', 4: 'Butte', 5: 'Calaveras',
      6: 'Colusa', 7: 'Contra Costa', 8: 'Del Norte', 9: 'El Dorado', 10: 'Fresno',
      11: 'Glenn', 12: 'Humboldt', 13: 'Imperial', 14: 'Inyo', 15: 'Kern',
      16: 'Kings', 17: 'Lake', 18: 'Lassen', 19: 'Los Angeles', 20: 'Madera',
      21: 'Marin', 22: 'Mariposa', 23: 'Mendocino', 24: 'Merced', 25: 'Modoc',
      26: 'Mono', 27: 'Monterey', 28: 'Napa', 29: 'Nevada', 30: 'Orange',
      31: 'Placer', 32: 'Plumas', 33: 'Riverside', 34: 'Sacramento', 35: 'San Benito',
      36: 'San Bernardino', 37: 'San Diego', 38: 'San Francisco', 39: 'San Joaquin',
      40: 'San Luis Obispo', 41: 'San Mateo', 42: 'Santa Barbara', 43: 'Santa Clara',
      44: 'Santa Cruz', 45: 'Shasta', 46: 'Sierra', 47: 'Siskiyou', 48: 'Solano',
      49: 'Sonoma', 50: 'Stanislaus', 51: 'Sutter', 52: 'Tehama', 53: 'Trinity',
      54: 'Tulare', 55: 'Tuolumne', 56: 'Ventura', 57: 'Yolo', 58: 'Yuba',
    };
    return countyMap[countyCode] || null;
  }

  async pollAll(options?: { limit?: number; startDate?: string; endDate?: string }): Promise<{ success: boolean; stats?: any; error?: string }> {
    if (this.pollingActive) {
      return { success: false, error: 'Polling already in progress' };
    }
    
    this.pollingActive = true;
    const startTime = Date.now();
    
    try {
      const limit = options?.limit || 5000;
      const startDate = options?.startDate || '2026-01-01';
      const endDate = options?.endDate || new Date().toISOString().split('T')[0];
      
      console.log(`\n🚦 Starting CHP Historical poll at ${new Date().toISOString()}`);
      console.log(`  Date range: ${startDate} to ${endDate}`);
      console.log(`  Target: ${limit} records (local counties: Humboldt, Mendocino)`);
      
      const result = await this.fetchCollisions({ limit, startDate, endDate });
      
      if (!result.success || result.records.length === 0) {
        console.log(`  ⚠️ No local records found in date range ${startDate} to ${endDate}`);
        return {
          success: true,
          stats: { totalFetched: 0, newCount: 0, duration: Date.now() - startTime, dateRange: { startDate, endDate } },
          timestamp: new Date().toISOString()
        };
      }
      
      console.log(`  Processing ${result.records.length} local records...`);
      
      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      
      for (const record of result.records) {
        const result = await this.upsertCollision(record);
        if (result === 'new') newCount++;
        else if (result === 'updated') updatedCount++;
        else skippedCount++;
      }
      
      const duration = Date.now() - startTime;
      this.lastPollTime = new Date();
      this.lastPollStats = { 
        totalFetched: result.records.length, 
        newCount, 
        updatedCount, 
        skippedCount, 
        duration,
        dateRange: { startDate, endDate }
      };
      
      console.log(`✅ CHP Historical Poll complete: ${newCount} new, ${updatedCount} updated, ${skippedCount} skipped`);
      
      return {
        success: true,
        stats: this.lastPollStats,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('CHP Historical Polling error:', error);
      return { success: false, error: String(error) };
    } finally {
      this.pollingActive = false;
    }
  }

  async getStats() {
    const total = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chpCollisions);
    
    const bySeverity = await db
      .select({
        severity: chpCollisions.severity,
        count: sql<number>`COUNT(*)`,
      })
      .from(chpCollisions)
      .groupBy(chpCollisions.severity);
    
    const byYear = await db
      .select({
        year: chpCollisions.collisionYear,
        count: sql<number>`COUNT(*)`,
      })
      .from(chpCollisions)
      .where(sql`${chpCollisions.collisionYear} IS NOT NULL`)
      .groupBy(chpCollisions.collisionYear)
      .orderBy(sql`year DESC`);
    
    return {
      total: total[0]?.count || 0,
      bySeverity: bySeverity,
      byYear: byYear,
      lastPoll: this.lastPollTime,
      lastPollStats: this.lastPollStats
    };
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}