// src/lib/services/CaltransPoller.ts
import axios from 'axios';
import { db } from '@/lib/db/client';
import { laneClosures, apiRequestLogs } from '@/lib/auth/schema';
import { eq, and, sql } from 'drizzle-orm';

const DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export class CaltransPoller {
  private baseUrl = 'https://cwwp2.dot.ca.gov/data';
  private userAgent = 'Caltrans-Data-Collector/1.0';
  
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  async pollAll() {
    if (this.pollingActive) {
      return { success: false, error: 'Polling already in progress' };
    }
    
    this.pollingActive = true;
    const startTime = Date.now();
    
    let totalClosures = 0;
    let totalNew = 0;
    
    for (const district of DISTRICTS) {
      const result = await this.fetchDistrict(district);
      totalClosures += result.count;
      totalNew += result.newCount;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    this.lastPollTime = new Date();
    this.lastPollStats = { totalClosures, totalNew, duration: Date.now() - startTime };
    this.pollingActive = false;
    
    return { success: true, stats: this.lastPollStats };
  }

  private async fetchDistrict(district: number) {
    try {
      const url = `${this.baseUrl}/d${district}/lcs/lcsStatusD${district.toString().padStart(2, '0')}.json`;
      const response = await axios.get(url, { timeout: 10000 });
      
      const closures = response.data?.lcsClosures || [];
      let newCount = 0;
      
      for (const closure of closures) {
        const sourceId = closure.lcsClosureID || `${district}_${closure.route}_${closure.startDate}`;
        
        const existing = await db
          .select()
          .from(laneClosures)
          .where(eq(laneClosures.sourceId, sourceId))
          .limit(1);
        
        if (existing.length === 0) {
          await db.insert(laneClosures).values({
            sourceId: sourceId,
            district: district,
            route: closure.route || 'Unknown',
            direction: closure.direction || 'Unknown',
            closureType: closure.closureType || 'Unknown',
            lanesAffected: closure.lanesAffected,
            description: closure.description,
            startDate: closure.startDate,
            endDate: closure.endDate,
            latitude: closure.latitude ? parseFloat(closure.latitude) : null,
            longitude: closure.longitude ? parseFloat(closure.longitude) : null,
            status: 'active',
            rawData: closure,
          });
          newCount++;
        }
      }
      
      return { count: closures.length, newCount };
    } catch (error) {
      console.error(`Error fetching district ${district}:`, error);
      return { count: 0, newCount: 0 };
    }
  }

  // Add to CaltransPoller.ts
  async getStats() {
    const total = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(laneClosures);
    
    const active = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(laneClosures)
      .where(eq(laneClosures.status, 'active'));
    
    return {
      total: Number(total[0]?.count || 0),
      active: Number(active[0]?.count || 0),
      lastPoll: this.lastPollTime,
      lastPollStats: this.lastPollStats
    };
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }

}