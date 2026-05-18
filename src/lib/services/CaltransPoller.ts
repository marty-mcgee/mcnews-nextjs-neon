// src/lib/services/CaltransPoller.ts
import axios from 'axios';
import { db } from '@/lib/db/client';
import { laneClosures, apiRequestLogs } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

interface CaltransClosure {
  lcsClosureID?: string;
  route?: string;
  direction?: string;
  closureType?: string;
  type?: string;
  lanesAffected?: string;
  lanesClosed?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  comments?: string;
  latitude?: string | number;
  longitude?: string | number;
  county?: string;
  city?: string;
  status?: string;
}

export class CaltransPoller {
  private districts: number[];
  private baseUrl = 'https://cwwp2.dot.ca.gov/data';
  private userAgent = 'Caltrans-Data-Collector/1.0 (research+data@example.com)';
  
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  constructor() {
    const districtsEnv = process.env.CALTRANS_DISTRICTS || '1,2,3,4,5,6,7,8,9,10,11,12';
    this.districts = districtsEnv.split(',').map(d => parseInt(d.trim()));
  }

  async fetchDistrictData(district: number): Promise<any | null> {
    const startTime = Date.now();
    const url = `${this.baseUrl}/d${district}/lcs/lcsStatusD${district.toString().padStart(2, '0')}.json`;
    
    try {
      console.log(`[${new Date().toISOString()}] Fetching Caltrans district ${district}...`);
      
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000,
        validateStatus: (status) => status === 200 || status === 404
      });
      
      const responseTime = Date.now() - startTime;
      
      await this.logApiRequest({
        endpoint: url,
        district,
        responseTimeMs: responseTime,
        statusCode: response.status,
        success: response.status === 200,
        recordsFetched: response.data?.lcsClosures?.length || 0,
        responseSizeBytes: JSON.stringify(response.data).length
      });
      
      if (response.status === 404 || !response.data?.lcsClosures) {
        console.log(`No lane closure data for District ${district}`);
        return null;
      }
      
      console.log(`✓ District ${district}: ${response.data.lcsClosures.length} closures`);
      return response.data;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.logApiRequest({
        endpoint: url,
        district,
        responseTimeMs: responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      console.error(`✗ District ${district} failed:`, error);
      return null;
    }
  }

  private async logApiRequest(logData: {
    endpoint: string;
    district?: number;
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

  private determineStatus(closure: CaltransClosure): 'active' | 'completed' | 'cancelled' {
    if (closure.status === 'cancelled') return 'cancelled';
    
    if (closure.endDate) {
      const endDateTime = new Date(`${closure.endDate}T${closure.endTime || '23:59'}`);
      if (endDateTime < new Date()) {
        return 'completed';
      }
    }
    
    return 'active';
  }

  private async upsertClosure(district: number, closure: CaltransClosure): Promise<'new' | 'updated' | 'skipped'> {
    const sourceId = closure.lcsClosureID || 
      `${district}_${closure.route}_${closure.startDate}_${closure.startTime}`;
    
    const startDate = closure.startDate || new Date().toISOString().split('T')[0];
    const endDate = closure.endDate || '2099-12-31';
    const startTime = closure.startTime || '00:00';
    const endTime = closure.endTime || '23:59';
    
    const status = this.determineStatus(closure);
    
    const closureData = {
      sourceId,
      district,
      route: closure.route || 'Unknown',
      direction: closure.direction || 'Unknown',
      closureType: closure.closureType || closure.type || 'Unknown',
      lanesAffected: closure.lanesAffected || closure.lanesClosed || 'Unknown',
      startDate,
      endDate,
      startTime,
      endTime,
      startTimestamp: new Date(`${startDate}T${startTime}`),
      endTimestamp: new Date(`${endDate}T${endTime}`),
      description: closure.description || closure.comments || 
        `${closure.closureType || 'Closure'} on ${closure.route || 'unknown route'}`,
      latitude: closure.latitude ? parseFloat(closure.latitude as string) : null,
      longitude: closure.longitude ? parseFloat(closure.longitude as string) : null,
      county: closure.county || null,
      city: closure.city || null,
      status,
      rawData: closure,
      lastSeen: new Date(),
    };
    
    const existing = await db
      .select()
      .from(laneClosures)
      .where(eq(laneClosures.sourceId, sourceId))
      .limit(1);
    
    if (existing.length > 0) {
      const shouldUpdate = existing[0].status !== status || 
                          (Date.now() - new Date(existing[0].lastSeen).getTime()) > 3600000;
      
      if (shouldUpdate) {
        await db
          .update(laneClosures)
          .set({
            ...closureData,
            timesSeen: sql`${laneClosures.timesSeen} + 1`,
            lastModified: new Date(),
          })
          .where(eq(laneClosures.sourceId, sourceId));
        return 'updated';
      }
      return 'skipped';
    } else {
      await db.insert(laneClosures).values(closureData);
      return 'new';
    }
  }

  async pollAllDistricts(): Promise<{ success: boolean; stats?: any; error?: string }> {
    if (this.pollingActive) {
      return { success: false, error: 'Polling already in progress' };
    }
    
    this.pollingActive = true;
    const startTime = Date.now();
    
    try {
      console.log(`\n🚦 Starting Caltrans poll at ${new Date().toISOString()}`);
      
      let totalClosures = 0;
      let totalNew = 0;
      let totalUpdated = 0;
      const results: Record<number, { processed: number; new: number; updated: number }> = {};
      
      for (const district of this.districts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const data = await this.fetchDistrictData(district);
        if (data?.lcsClosures) {
          let newCount = 0;
          let updatedCount = 0;
          let processed = 0;
          
          for (const closure of data.lcsClosures) {
            const result = await this.upsertClosure(district, closure);
            processed++;
            if (result === 'new') newCount++;
            if (result === 'updated') updatedCount++;
          }
          
          totalClosures += processed;
          totalNew += newCount;
          totalUpdated += updatedCount;
          results[district] = { processed, new: newCount, updated: updatedCount };
        } else {
          results[district] = { processed: 0, new: 0, updated: 0 };
        }
      }
      
      const duration = Date.now() - startTime;
      this.lastPollTime = new Date();
      this.lastPollStats = { totalClosures, totalNew, totalUpdated, results, duration };
      
      console.log(`✅ Caltrans Poll complete: ${totalClosures} closures processed`);
      
      return {
        success: true,
        stats: this.lastPollStats,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Caltrans Polling error:', error);
      return { success: false, error: String(error) };
    } finally {
      this.pollingActive = false;
    }
  }

  async getStats() {
    const activeCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(laneClosures)
      .where(eq(laneClosures.status, 'active'));
    
    const total = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(laneClosures);
    
    return {
      total: total[0]?.count || 0,
      active: activeCount[0]?.count || 0,
      lastPoll: this.lastPollTime,
      lastPollStats: this.lastPollStats
    };
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}
