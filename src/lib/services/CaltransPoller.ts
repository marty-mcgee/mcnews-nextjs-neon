// src/lib/services/CaltransPoller.ts
import axios from 'axios';
import { db } from '@/lib/db/client';
import { laneClosures, apiRequestLogs } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

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

  async fetchDistrictData(district: number) {
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
        return null;
      }
      
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

  private determineStatus(closure: any): 'active' | 'completed' | 'cancelled' {
    if (closure.status === 'cancelled') return 'cancelled';
    if (closure.endDate) {
      const endDateTime = new Date(`${closure.endDate}T${closure.endTime || '23:59'}`);
      if (endDateTime < new Date()) return 'completed';
    }
    return 'active';
  }

  private async upsertClosure(district: number, closure: any): Promise<'new' | 'updated' | 'skipped'> {
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
      latitude: closure.latitude ? parseFloat(closure.latitude) : null,
      longitude: closure.longitude ? parseFloat(closure.longitude) : null,
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
          .set({ ...closureData, timesSeen: sql`${laneClosures.timesSeen} + 1`, lastModified: new Date() })
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
      
      for (const district of this.districts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const data = await this.fetchDistrictData(district);
        
        if (data?.lcsClosures) {
          for (const closure of data.lcsClosures) {
            const result = await this.upsertClosure(district, closure);
            totalClosures++;
            if (result === 'new') totalNew++;
            if (result === 'updated') totalUpdated++;
          }
        }
      }
      
      const duration = Date.now() - startTime;
      this.lastPollTime = new Date();
      this.lastPollStats = { totalClosures, totalNew, totalUpdated, duration };
      
      console.log(`✅ Caltrans Poll complete: ${totalClosures} closures processed`);
      
      return { success: true, stats: this.lastPollStats };
    } finally {
      this.pollingActive = false;
    }
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}