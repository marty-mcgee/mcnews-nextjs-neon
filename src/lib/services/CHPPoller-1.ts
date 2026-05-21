// src/lib/services/CHPPoller.ts
import axios from 'axios';
import { db } from '@/lib/db/client';
import { chpCollisions, apiRequestLogs } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

export class CHPPoller {
  private resourceId = 'b8ce0ca4-b4e9-490d-b4d1-1f4ec48cbefb';
  private baseUrl = 'https://data.ca.gov/api/3/action/datastore_search';
  private userAgent = 'CHP-Data-Collector/1.0 (research+data@example.com)';
  
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  async fetchCollisions(options: { limit?: number; offset?: number } = {}) {
    const startTime = Date.now();
    const { limit = 100, offset = 0 } = options;
    
    try {
      console.log(`[${new Date().toISOString()}] Fetching CHP collision data (offset: ${offset})...`);
      
      const response = await axios.get(this.baseUrl, {
        params: {
          resource_id: this.resourceId,
          limit,
          offset
        },
        headers: { 'User-Agent': this.userAgent },
        timeout: 30000
      });
      
      const responseTime = Date.now() - startTime;
      const records = response.data?.result?.records || [];
      const total = response.data?.result?.total || 0;
      const success = response.data?.success === true;
      
      console.log(`  ✓ Fetched ${records.length} records (total available: ${total})`);
      
      await this.logApiRequest({
        endpoint: this.baseUrl,
        responseTimeMs: responseTime,
        statusCode: response.status,
        success: success,
        recordsFetched: records.length,
        responseSizeBytes: JSON.stringify(response.data).length
      });
      
      return { success, records, total };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`✗ CHP API failed:`, error);
      await this.logApiRequest({
        endpoint: this.baseUrl,
        responseTimeMs: responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return { success: false, records: [], total: 0 };
    }
  }

  private async logApiRequest(logData: {
    endpoint: string;
    responseTimeMs: number;
    statusCode?: number;
    success: boolean;
    recordsFetched?: number;
    errorMessage?: string;
    responseSizeBytes?: number;
  }) {
    try {
      await db.insert(apiRequestLogs).values({
        endpoint: logData.endpoint,
        responseTimeMs: logData.responseTimeMs,
        statusCode: logData.statusCode,
        success: logData.success,
        recordsFetched: logData.recordsFetched || 0,
        errorMessage: logData.errorMessage,
        responseSizeBytes: logData.responseSizeBytes
      });
    } catch (error) {
      console.error('Failed to log API request:', error);
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
      county: this.mapCountyCodeToName(record['County Code']),
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

  async pollAll(options?: { limit?: number }): Promise<{ success: boolean; stats?: any; error?: string }> {
    if (this.pollingActive) {
      return { success: false, error: 'Polling already in progress' };
    }
    
    this.pollingActive = true;
    const startTime = Date.now();
    
    try {
      const limit = options?.limit || 100;
      console.log(`\n🚦 Starting CHP Historical poll at ${new Date().toISOString()}`);
      console.log(`  Fetching up to ${limit} records...`);
      
      const result = await this.fetchCollisions({ offset: 0, limit });
      
      if (!result.success || result.records.length === 0) {
        return { success: true, stats: { totalFetched: 0, newCount: 0, updatedCount: 0, skippedCount: 0 } };
      }
      
      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      
      for (const record of result.records) {
        const upsertResult = await this.upsertCollision(record);
        if (upsertResult === 'new') newCount++;
        else if (upsertResult === 'updated') updatedCount++;
        else skippedCount++;
      }
      
      const duration = Date.now() - startTime;
      this.lastPollTime = new Date();
      this.lastPollStats = { totalFetched: result.records.length, newCount, updatedCount, skippedCount, duration };
      
      console.log(`✅ CHP Historical Poll complete: ${result.records.length} fetched, ${newCount} new`);
      
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
    const severityCounts = await db
      .select({
        severity: chpCollisions.severity,
        count: sql<number>`COUNT(*)`,
      })
      .from(chpCollisions)
      .groupBy(chpCollisions.severity);
    
    const total = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chpCollisions);
    
    return {
      total: total[0]?.count || 0,
      bySeverity: severityCounts,
      lastPoll: this.lastPollTime,
      lastPollStats: this.lastPollStats
    };
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}