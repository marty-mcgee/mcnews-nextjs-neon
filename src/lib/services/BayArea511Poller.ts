// src/lib/services/BayArea511Poller.ts
import axios from 'axios';
import { db } from '@/lib/db/client';
import { bayAreaTrafficEvents, apiRequestLogs } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

export class BayArea511Poller {
  private apiKey: string;
  private baseUrl = 'http://api.511.org/traffic/events';
  private userAgent = 'BayArea-Traffic-Monitor/1.0';
  
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  constructor() {
    this.apiKey = process.env.BAY_AREA_511_API_KEY || '';
    if (!this.apiKey) {
      console.warn('BAY_AREA_511_API_KEY environment variable is not set');
    }
  }

  async pollAll(): Promise<{ success: boolean; stats?: any; error?: string }> {
    if (this.pollingActive) {
      return { success: false, error: 'Polling already in progress' };
    }
    
    this.pollingActive = true;
    const startTime = Date.now();
    
    try {
      console.log(`\n🚦 Starting Bay Area 511 poll at ${new Date().toISOString()}`);
      
      // Fetch events directly
      const response = await axios.get(this.baseUrl, {
        params: {
          api_key: this.apiKey,
          format: 'json'
        },
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000
      });
      
      // The API returns an object with an 'events' array
      let events: any[] = [];
      if (response.data && Array.isArray(response.data)) {
        events = response.data;
      } else if (response.data?.events && Array.isArray(response.data.events)) {
        events = response.data.events;
      } else {
        console.log('Unexpected API response format:', typeof response.data);
        events = [];
      }
      
      console.log(`  Fetched ${events.length} events from 511 API`);
      
      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      
      for (const event of events) {
        const result = await this.upsertEvent(event);
        if (result === 'new') newCount++;
        else if (result === 'updated') updatedCount++;
        else skippedCount++;
      }
      
      const duration = Date.now() - startTime;
      this.lastPollTime = new Date();
      this.lastPollStats = { 
        totalFetched: events.length, 
        newCount, 
        updatedCount, 
        skippedCount, 
        duration 
      };
      
      console.log(`✅ Bay Area 511 Poll complete: ${events.length} fetched, ${newCount} new`);
      
      return {
        success: true,
        stats: this.lastPollStats,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Bay Area 511 Polling error:', error);
      return { success: false, error: String(error) };
    } finally {
      this.pollingActive = false;
    }
  }

  private async upsertEvent(event: any): Promise<'new' | 'updated' | 'skipped'> {
    // Extract unique ID from the event
    const sourceId = event.id || event.ID || `511_${Date.now()}`;
    
    // Parse the event data
    const eventData = {
      sourceId: sourceId,
      eventType: event.event_type || event.EventType,
      eventSubType: event.event_subtypes?.[0],
      severity: event.severity,
      status: event.status === 'ACTIVE' ? 'active' : 'inactive',
      title: event.headline?.substring(0, 200),
      description: event.headline,
      roadwayName: event.roads?.[0]?.name,
      directionOfTravel: event.roads?.[0]?.direction,
      lanesAffected: event.roads?.[0]?.state,
      isFullClosure: event.roads?.[0]?.state === 'CLOSED',
      latitude: event.geography?.coordinates?.[1],
      longitude: event.geography?.coordinates?.[0],
      startTime: event.schedule?.intervals?.[0]?.split('/')[0] ? new Date(event.schedule.intervals[0].split('/')[0]) : null,
      endTime: event.schedule?.intervals?.[0]?.split('/')[1] ? new Date(event.schedule.intervals[0].split('/')[1]) : null,
      lastUpdated: event.updated ? new Date(event.updated) : new Date(),
      rawData: event,
      fetchedAt: new Date(),
    };
    
    // Check if event already exists
    const existing = await db
      .select()
      .from(bayAreaTrafficEvents)
      .where(eq(bayAreaTrafficEvents.sourceId, sourceId))
      .limit(1);
    
    if (existing.length > 0) {
      // Update if the event has changed significantly
      const lastUpdate = existing[0].lastUpdated || existing[0].fetchedAt;
      const hoursSinceUpdate = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceUpdate > 6) {
        await db
          .update(bayAreaTrafficEvents)
          .set({ ...eventData, updatedAt: new Date() })
          .where(eq(bayAreaTrafficEvents.sourceId, sourceId));
        return 'updated';
      }
      return 'skipped';
    } else {
      await db.insert(bayAreaTrafficEvents).values(eventData);
      console.log(`  ✨ New event: ${sourceId} - ${event.event_type || 'Unknown'}`);
      return 'new';
    }
  }

  async getStats() {
    const total = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(bayAreaTrafficEvents);
    
    const byType = await db
      .select({
        type: bayAreaTrafficEvents.eventType,
        count: sql<number>`COUNT(*)`,
      })
      .from(bayAreaTrafficEvents)
      .groupBy(bayAreaTrafficEvents.eventType);
    
    const active = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(bayAreaTrafficEvents)
      .where(eq(bayAreaTrafficEvents.status, 'active'));
    
    return {
      total: Number(total[0]?.count || 0),
      active: Number(active[0]?.count || 0),
      byType: byType,
      lastPoll: this.lastPollTime,
      lastPollStats: this.lastPollStats
    };
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}