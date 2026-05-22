// src/lib/services/CHPPoller.ts
import axios from 'axios';
import { db } from '@/lib/db/client';
import { chpCollisions, apiRequestLogs } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

export class CHPPoller {
  private resourceId = 'b8ce0ca4-b4e9-490d-b4d1-1f4ec48cbefb';
  private baseUrl = 'https://data.ca.gov/api/3/action/datastore_search';
  
  // Add these missing properties
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  async pollAll(options?: { limit?: number }) {
    if (this.pollingActive) {
      return { success: false, error: 'Polling already in progress' };
    }
    
    this.pollingActive = true;
    const startTime = Date.now();
    const limit = options?.limit || 100;
    
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          resource_id: this.resourceId,
          limit: limit,
          offset: 0
        },
        timeout: 30000
      });
      
      const records = response.data?.result?.records || [];
      let newCount = 0;
      
      for (const record of records) {
        const caseId = record['Report Number'];
        if (!caseId) continue;
        
        const existing = await db
          .select()
          .from(chpCollisions)
          .where(eq(chpCollisions.caseId, caseId))
          .limit(1);
        
        if (existing.length === 0) {
          await db.insert(chpCollisions).values({
            caseId: caseId,
            collisionDate: record['Crash Date Time'] ? new Date(record['Crash Date Time']) : null,
            collisionYear: record['Crash Date Time'] ? new Date(record['Crash Date Time']).getFullYear() : null,
            severity: record['Collision Type Description'],
            county: null,
            city: record['City Name'],
            location: record['Primary Road'],
            injuries: record['NumberInjured'] || 0,
            fatalities: record['NumberKilled'] || 0,
            rawData: record,
          });
          newCount++;
        }
      }
      
      this.lastPollTime = new Date();
      this.lastPollStats = { totalFetched: records.length, newCount, duration: Date.now() - startTime };
      this.pollingActive = false;
      
      return { success: true, stats: this.lastPollStats };
      
    } catch (error) {
      this.pollingActive = false;
      console.error('CHP Historical Poller error:', error);
      return { success: false, error: String(error) };
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
    
    return {
      total: Number(total[0]?.count || 0),
      bySeverity: bySeverity,
      lastPoll: this.lastPollTime,
      lastPollStats: this.lastPollStats
    };
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}