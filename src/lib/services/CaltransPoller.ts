// src/lib/services/CaltransPoller.ts
import axios from 'axios';
import { db } from '@/lib/db/client';
import { laneClosures, apiRequestLogs } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

const DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export class CaltransPoller {
  private baseUrl = 'https://cwwp2.dot.ca.gov/data';
  private userAgent = 'Caltrans-Data-Collector/1.0';
  
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  async pollAll(): Promise<{ success: boolean; stats?: any; error?: string }> {
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
      const results: Record<number, { count: number; new: number }> = {};
      
      for (const district of DISTRICTS) {
        const result = await this.fetchDistrict(district);
        totalClosures += result.count;
        totalNew += result.newCount;
        results[district] = { count: result.count, new: result.newCount };
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const duration = Date.now() - startTime;
      this.lastPollTime = new Date();
      this.lastPollStats = { totalClosures, totalNew, totalUpdated, results, duration };
      
      console.log(`✅ Caltrans Poll complete: ${totalClosures} total closures, ${totalNew} new`);
      
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

  private async fetchDistrict(district: number) {
    try {
      const url = `${this.baseUrl}/d${district}/lcs/lcsStatusD${district.toString().padStart(2, '0')}.json`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000
      });
      
      const closures = response.data?.lcsClosures || [];
      let newCount = 0;
      
      for (const closure of closures) {
        const result = await this.upsertClosure(district, closure);
        if (result === 'new') newCount++;
      }
      
      console.log(`  District ${district}: ${closures.length} closures, ${newCount} new`);
      return { count: closures.length, newCount };
      
    } catch (error) {
      console.error(`  Error fetching district ${district}:`, error);
      return { count: 0, newCount: 0 };
    }
  }

  private async upsertClosure(district: number, closure: any): Promise<'new' | 'updated' | 'skipped'> {
    const sourceId = closure.lcsClosureID || 
      `${district}_${closure.route}_${closure.startDate}_${closure.startTime}`;
    
    const status = this.determineStatus(closure);
    
    const closureData = {
      sourceId,
      district,
      route: closure.route || 'Unknown',
      direction: closure.direction || 'Unknown',
      closureType: closure.closureType || closure.type || 'Unknown',
      lanesAffected: closure.lanesAffected || closure.lanesClosed,
      startDate: closure.startDate,
      endDate: closure.endDate,
      startTime: closure.startTime,
      endTime: closure.endTime,
      description: closure.description || closure.comments,
      latitude: closure.latitude ? parseFloat(closure.latitude) : null,
      longitude: closure.longitude ? parseFloat(closure.longitude) : null,
      county: closure.county,
      city: closure.city,
      status: status,
      rawData: closure,
      lastSeen: new Date(),
    };
    
    const existing = await db
      .select()
      .from(laneClosures)
      .where(eq(laneClosures.sourceId, sourceId))
      .limit(1);
    
    if (existing.length > 0) {
      // Update if status changed
      if (existing[0].status !== status) {
        await db
          .update(laneClosures)
          .set({ ...closureData, timesSeen: sql`${laneClosures.timesSeen} + 1` })
          .where(eq(laneClosures.sourceId, sourceId));
        return 'updated';
      }
      return 'skipped';
    } else {
      await db.insert(laneClosures).values(closureData);
      return 'new';
    }
  }

  private determineStatus(closure: any): 'active' | 'completed' | 'cancelled' {
    if (closure.status === 'cancelled') return 'cancelled';
    
    if (closure.endDate) {
      const endDateTime = new Date(`${closure.endDate}T${closure.endTime || '23:59'}`);
      if (endDateTime < new Date()) {
        return 'completed';
      }
    }
    
    return 'active';
  }

  async getStats() {
    const total = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(laneClosures);
    
    const active = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(laneClosures)
      .where(eq(laneClosures.status, 'active'));
    
    const byDistrict = await db
      .select({
        district: laneClosures.district,
        count: sql<number>`COUNT(*)`,
      })
      .from(laneClosures)
      .where(eq(laneClosures.status, 'active'))
      .groupBy(laneClosures.district)
      .orderBy(laneClosures.district);
    
    return {
      total: Number(total[0]?.count || 0),
      active: Number(active[0]?.count || 0),
      byDistrict: byDistrict,
      lastPoll: this.lastPollTime,
      lastPollStats: this.lastPollStats
    };
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}