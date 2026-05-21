// src/lib/services/CHPPoller.ts
import axios from 'axios';
import { db } from '@/lib/db/client';
import { chpCollisions, apiRequestLogs } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

export class CHPPoller {
  private resourceId = 'b8ce0ca4-b4e9-490d-b4d1-1f4ec48cbefb';
  private baseUrl = 'https://data.ca.gov/api/3/action/datastore_search';

  async fetchCollisionsDirect(limit: number = 100, offset: number = 0) {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          resource_id: this.resourceId,
          limit: limit,
          offset: offset
        }
      });
      
      return {
        success: response.data?.success || false,
        records: response.data?.result?.records || [],
        total: response.data?.result?.total || 0
      };
    } catch (error) {
      console.error('Fetch error:', error);
      return { success: false, records: [], total: 0 };
    }
  }

  async pollAll(options?: { limit?: number }): Promise<{ success: boolean; stats?: any }> {
    const limit = options?.limit || 100;
    
    try {
      console.log(`Fetching ${limit} CHP records...`);
      
      const result = await this.fetchCollisionsDirect(limit, 0);
      
      if (!result.success || result.records.length === 0) {
        return { success: true, stats: { totalFetched: 0, newCount: 0 } };
      }
      
      let newCount = 0;
      
      for (const record of result.records) {
        const caseId = record['Report Number'];
        
        if (!caseId) continue;
        
        // Check if exists
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
      
      return { 
        success: true, 
        stats: { totalFetched: result.records.length, newCount } 
      };
      
    } catch (error) {
      console.error('CHP Polling error:', error);
      return { success: false, stats: { error: String(error) } };
    }
  }
}