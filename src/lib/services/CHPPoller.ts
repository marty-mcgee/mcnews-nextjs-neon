// src/lib/services/CHPPoller.ts
import axios from 'axios';
import { db } from '@/lib/db/client';
import { chpCollisions, apiRequestLogs } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

interface CHPCollisionRecord {
  case_id: string;
  collision_date: string;
  collision_year: number;
  collision_severity: string;
  county_name: string;
  city: string;
  location: string;
  latitude: string | number;
  longitude: string | number;
  primary_collision_factor: string;
  weather_1: string;
  road_lighting: string;
  number_injured: number;
  number_killed: number;
}

export class CHPPoller {
  private resourceId = 'd932d5a6-7a65-47c0-9303-3c62514f8ee1';
  private baseUrl = 'https://data.ca.gov/api/3/action/datastore_search';
  private userAgent = 'CHP-Data-Collector/1.0 (contact@example.com)';
  
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  async fetchCollisions(options: {
    limit?: number;
    offset?: number;
    county?: string;
    year?: number;
    severity?: string;
  } = {}) {
    const startTime = Date.now();
    const { limit = 100, offset = 0, county, year, severity } = options;
    
    const filters: any = {};
    if (county) filters.county_name = county;
    if (year) filters.collision_year = year;
    if (severity) filters.collision_severity = severity;
    
    try {
      console.log(`[${new Date().toISOString()}] Fetching CHP collision data...`);
      
      const response = await axios.get(this.baseUrl, {
        params: {
          resource_id: this.resourceId,
          limit,
          offset,
          filters: JSON.stringify(filters)
        },
        headers: { 'User-Agent': this.userAgent },
        timeout: 30000
      });
      
      const responseTime = Date.now() - startTime;
      const fetchedRecords = response.data?.result?.records || [];
      
      await this.logApiRequest({
        endpoint: this.baseUrl,
        responseTimeMs: responseTime,
        statusCode: response.status,
        success: response.data?.success === true,
        recordsFetched: fetchedRecords.length,
        responseSizeBytes: JSON.stringify(response.data).length
      });
      
      if (response.data?.success) {
        console.log(`✓ CHP API: ${fetchedRecords.length} collisions fetched`);
        return {
          success: true,
          records: fetchedRecords,
          total: response.data.result.total,
          offset: response.data.result.offset,
          limit: response.data.result.limit
        };
      }
      
      return { success: false, records: [], error: 'API returned unsuccessful' };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.logApiRequest({
        endpoint: this.baseUrl,
        responseTimeMs: responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      console.error('✗ CHP API failed:', error);
      return { success: false, records: [], error };
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

  async processCollisions(records: CHPCollisionRecord[]): Promise<{ new: number; updated: number; skipped: number }> {
    let newCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const record of records) {
      const result = await this.upsertCollision(record);
      if (result === 'new') newCount++;
      else if (result === 'updated') updatedCount++;
      else skippedCount++;
    }
    
    return { new: newCount, updated: updatedCount, skipped: skippedCount };
  }

  private async upsertCollision(record: CHPCollisionRecord): Promise<'new' | 'updated' | 'skipped'> {
    const caseId = record.case_id;
    
    const collisionData = {
      caseId: record.case_id,
      collisionDate: record.collision_date ? new Date(record.collision_date) : null,
      collisionYear: record.collision_year,
      severity: record.collision_severity,
      county: record.county_name,
      city: record.city,
      location: record.location,
      latitude: record.latitude ? parseFloat(record.latitude as string) : null,
      longitude: record.longitude ? parseFloat(record.longitude as string) : null,
      primaryFactor: record.primary_collision_factor,
      weather: record.weather_1,
      lighting: record.road_lighting,
      injuries: record.number_injured,
      fatalities: record.number_killed,
      rawData: record,
      lastSeen: new Date(),
    };
    
    const existing = await db
      .select()
      .from(chpCollisions)
      .where(eq(chpCollisions.caseId, caseId))
      .limit(1);
    
    if (existing.length > 0) {
      // @ts-expect-error
      const lastUpdate = new Date(existing[0].lastSeen || existing[0].fetchedAt);
      const shouldUpdate = (Date.now() - lastUpdate.getTime()) > (7 * 24 * 60 * 60 * 1000);
      
      if (shouldUpdate) {
        await db
          .update(chpCollisions)
          .set({ ...collisionData, updatedAt: new Date() })
          .where(eq(chpCollisions.caseId, caseId));
        return 'updated';
      }
      return 'skipped';
    } else {
      await db.insert(chpCollisions).values(collisionData);
      return 'new';
    }
  }

  async pollAll(options?: { county?: string; year?: number; limit?: number }) {
    if (this.pollingActive) {
      return { success: false, message: 'Polling already in progress' };
    }
    
    this.pollingActive = true;
    const startTime = Date.now();
    
    try {
      console.log(`\n🚦 Starting CHP Collision poll at ${new Date().toISOString()}`);
      
      let allRecords: CHPCollisionRecord[] = [];
      let currentOffset = 0;
      const maxRecords = options?.limit || 1000;
      let hasMore = true;
      
      while (hasMore && allRecords.length < maxRecords) {
        const fetchResult = await this.fetchCollisions({ 
          ...options, 
          offset: currentOffset, 
          limit: 100 
        });
        
        if (fetchResult.success && fetchResult.records.length > 0) {
          allRecords = [...allRecords, ...fetchResult.records];
          currentOffset += fetchResult.records.length;
          hasMore = fetchResult.records.length === 100;
        } else {
          hasMore = false;
        }
        
        // Small delay between pagination requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const processStats = await this.processCollisions(allRecords);
      const duration = Date.now() - startTime;
      this.lastPollTime = new Date();
      this.lastPollStats = { totalFetched: allRecords.length, ...processStats, duration };
      
      console.log(`✅ CHP Poll complete: ${allRecords.length} fetched, ${processStats.new} new, ${processStats.updated} updated`);
      
      return {
        success: true,
        stats: this.lastPollStats,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('CHP Polling error:', error);
      return { success: false, error: String(error) };
    } finally {
      this.pollingActive = false;
    }
  }

  async getStats() {
    try {
      const severityCounts = await db
        .select({
          severity: chpCollisions.severity,
          count: sql<number>`COUNT(*)`,
        })
        .from(chpCollisions)
        .groupBy(chpCollisions.severity)
        .catch(() => []);
      
      const countyCounts = await db
        .select({
          county: chpCollisions.county,
          count: sql<number>`COUNT(*)`,
        })
        .from(chpCollisions)
        .groupBy(chpCollisions.county)
        .orderBy(sql`count DESC`)
        .limit(10)
        .catch(() => []);
      
      const totalResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(chpCollisions)
        .catch(() => [{ count: 0 }]);
      
      return {
        total: Number(totalResult[0]?.count || 0),
        bySeverity: severityCounts,
        topCounties: countyCounts,
        lastPoll: this.lastPollTime,
        lastPollStats: this.lastPollStats
      };
    } catch (err) {
      console.error('Error in getStats:', err);
      return {
        total: 0,
        bySeverity: [],
        topCounties: [],
        lastPoll: null,
        lastPollStats: null
      };
    }
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}
