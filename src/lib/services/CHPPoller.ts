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
  // NOTE: You may need to update this resource_id to the correct active dataset
  private resourceId = 'd932d5a6-7a65-47c0-9303-3c62514f8ee1';
  private baseUrl = 'https://data.ca.gov/api/3/action/datastore_search';
  private userAgent = 'CHP-Data-Collector/1.0 (contact@example.com)';
  
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  async fetchCollisions(options: { limit?: number; offset?: number } = {}) {
    const startTime = Date.now();
    const { limit = 100, offset = 0 } = options;
    
    try {
      console.log(`[${new Date().toISOString()}] Fetching CHP collision data...`);
      
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
      
      await this.logApiRequest({
        endpoint: this.baseUrl,
        responseTimeMs: responseTime,
        statusCode: response.status,
        success: response.data?.success === true,
        recordsFetched: records.length,
        responseSizeBytes: JSON.stringify(response.data).length
      });
      
      if (response.data?.success) {
        console.log(`✓ CHP API: ${records.length} collisions fetched (total: ${total})`);
        return { success: true, records, total };
      }
      
      return { success: false, records: [], total: 0 };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.logApiRequest({
        endpoint: this.baseUrl,
        responseTimeMs: responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      console.error('✗ CHP API failed:', error);
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

  private async upsertCollision(record: CHPCollisionRecord): Promise<'new' | 'updated' | 'skipped'> {
    // Map snake_case API fields to your camelCase schema
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
      injuries: record.number_injured || 0,
      fatalities: record.number_killed || 0,
      rawData: record,
      lastSeen: new Date(),
    };
    
    const existing = await db
      .select()
      .from(chpCollisions)
      .where(eq(chpCollisions.caseId, caseId))
      .limit(1);
    
    if (existing.length > 0) {
      const lastUpdate = existing[0].lastSeen || existing[0].fetchedAt;
      const daysSinceUpdate = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUpdate > 7) {
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

  async pollAll(options?: { limit?: number }): Promise<{ success: boolean; stats?: any; error?: string }> {
    if (this.pollingActive) {
      return { success: false, error: 'Polling already in progress' };
    }
    
    this.pollingActive = true;
    const startTime = Date.now();
    
    try {
      console.log(`\n🚦 Starting CHP Historical poll at ${new Date().toISOString()}`);
      
      let allRecords: CHPCollisionRecord[] = [];
      let offset = 0;
      const limit = options?.limit || 500;
      let hasMore = true;
      
      while (hasMore && allRecords.length < limit) {
        const result = await this.fetchCollisions({ offset, limit: 100 });
        if (result.success && result.records.length > 0) {
          allRecords = [...allRecords, ...result.records];
          offset += result.records.length;
          hasMore = result.records.length === 100;
        } else {
          hasMore = false;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      
      for (const record of allRecords) {
        const result = await this.upsertCollision(record);
        if (result === 'new') newCount++;
        else if (result === 'updated') updatedCount++;
        else skippedCount++;
      }
      
      const duration = Date.now() - startTime;
      this.lastPollTime = new Date();
      this.lastPollStats = { totalFetched: allRecords.length, newCount, updatedCount, skippedCount, duration };
      
      console.log(`✅ CHP Historical Poll complete: ${allRecords.length} fetched, ${newCount} new, ${updatedCount} updated`);
      
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
