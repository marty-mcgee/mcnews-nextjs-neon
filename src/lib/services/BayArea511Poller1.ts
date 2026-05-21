// src/lib/services/BayArea511Poller.ts
import axios from 'axios';
import { db } from '@/lib/db/client';
import { bayAreaTrafficEvents, apiRequestLogs } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

interface EventResponse {
  ID?: number;
  SourceId?: string;
  Organization?: string;
  RoadwayName?: string;
  DirectionOfTravel?: string;
  Description?: string;
  Reported?: number;
  LastUpdated?: number;
  StartDate?: number;
  PlannedEndDate?: number;
  LanesAffected?: string;
  Latitude?: number;
  Longitude?: number;
  EventType?: string;
  EventSubType?: string;
  IsFullClosure?: boolean;
  Severity?: string;
}

export class BayArea511Poller {
  private apiKey: string;
  private baseUrl = 'http://api.511.org/traffic/events';
  private userAgent = 'BayArea-Traffic-Monitor/1.0 (research+data@example.com)';
  
  private pollingActive = false;
  private lastPollTime: Date | null = null;
  private lastPollStats: any = null;

  constructor() {
    this.apiKey = process.env.BAY_AREA_511_API_KEY || '';
    if (!this.apiKey) {
      console.warn('BAY_AREA_511_API_KEY environment variable is not set');
    }
  }

  async fetchEvents(): Promise<EventResponse[]> {
  const startTime = Date.now();
  
  try {
    console.log(`[${new Date().toISOString()}] Fetching Bay Area 511 traffic events...`);
    console.log(`🔑 API Key present: ${!!this.apiKey}`);
    console.log(`🔑 API Key length: ${this.apiKey?.length || 0}`);
    console.log(`📡 Full URL: ${this.baseUrl}?api_key=${this.apiKey?.substring(0, 5)}...&format=json`);
    
    const response = await axios.get(this.baseUrl, {
      params: {
        api_key: this.apiKey,
        format: 'json'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://511.org/',
        'Origin': 'https://511.org'
      },
      timeout: 15000
    });
    
    const responseTime = Date.now() - startTime;
    
    // Debug: Log the FULL response structure
    console.log(`📦 Response status: ${response.status}`);
    console.log(`📊 Response data type: ${typeof response.data}`);
    console.log(`📊 Response is array: ${Array.isArray(response.data)}`);
    console.log(`📊 Response data length: ${response.data?.length || 0}`);
    
    // Log the first 500 characters of the response
    console.log(`📝 Response preview: ${JSON.stringify(response.data).substring(0, 500)}`);
    
    const events = Array.isArray(response.data) ? response.data : [];
    
    await this.logApiRequest({
      endpoint: this.baseUrl,
      responseTimeMs: responseTime,
      statusCode: response.status,
      success: events.length > 0,
      recordsFetched: events.length,
      responseSizeBytes: JSON.stringify(response.data).length
    });
    
    console.log(`✓ Bay Area 511 API: ${events.length} events fetched`);
    return events;
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ API Error:`, error);
    await this.logApiRequest({
      endpoint: this.baseUrl,
      responseTimeMs: responseTime,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return [];
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

  private async upsertEvent(event: EventResponse): Promise<'new' | 'updated' | 'skipped'> {
    const sourceId = event.SourceId || `bay_area_${event.ID || Date.now()}`;
    
    const eventData = {
      sourceId: sourceId,
      eventType: event.EventType,
      eventSubType: event.EventSubType,
      severity: event.Severity,
      status: 'active',
      title: this.generateTitle(event),
      description: event.Description,
      roadwayName: event.RoadwayName,
      directionOfTravel: event.DirectionOfTravel,
      lanesAffected: event.LanesAffected,
      isFullClosure: event.IsFullClosure || false,
      latitude: event.Latitude ? parseFloat(event.Latitude as any) : null,
      longitude: event.Longitude ? parseFloat(event.Longitude as any) : null,
      startTime: event.StartDate ? new Date(event.StartDate * 1000) : null,
      endTime: event.PlannedEndDate ? new Date(event.PlannedEndDate * 1000) : null,
      lastUpdated: event.LastUpdated ? new Date(event.LastUpdated * 1000) : new Date(),
      rawData: event,
      fetchedAt: new Date(),
    };
    
    const existing = await db
      .select()
      .from(bayAreaTrafficEvents)
      .where(eq(bayAreaTrafficEvents.sourceId, sourceId))
      .limit(1);
    
    if (existing.length > 0) {
      const lastUpdate = existing[0].lastUpdated || existing[0].fetchedAt;
      const hoursSinceUpdate = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceUpdate > 6) {
        await db
          .update(bayAreaTrafficEvents)
          .set({ ...eventData, lastUpdated: new Date() })
          .where(eq(bayAreaTrafficEvents.sourceId, sourceId));
        return 'updated';
      }
      return 'skipped';
    } else {
      await db.insert(bayAreaTrafficEvents).values(eventData);
      return 'new';
    }
  }

  private generateTitle(event: EventResponse): string {
    if (event.Description) {
      return event.Description.substring(0, 200);
    }
    return `${event.EventType || 'Event'} on ${event.RoadwayName || 'unknown roadway'}`;
  }

  async pollAll(): Promise<{ success: boolean; stats?: any; error?: string }> {
    if (this.pollingActive) {
      return { success: false, error: 'Polling already in progress' };
    }
    
    this.pollingActive = true;
    const startTime = Date.now();
    
    try {
      console.log(`\n🚦 Starting Bay Area 511 poll at ${new Date().toISOString()}`);
      
      const events = await this.fetchEvents();
      
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
      this.lastPollStats = { totalFetched: events.length, newCount, updatedCount, skippedCount, duration };
      
      console.log(`✅ Bay Area 511 Poll complete: ${events.length} fetched, ${newCount} new, ${updatedCount} updated`);
      
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

  async getStats() {
    const typeCounts = await db
      .select({
        type: bayAreaTrafficEvents.eventType,
        count: sql<number>`COUNT(*)`,
      })
      .from(bayAreaTrafficEvents)
      .groupBy(bayAreaTrafficEvents.eventType);
    
    const activeCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(bayAreaTrafficEvents)
      .where(sql`${bayAreaTrafficEvents.endTime} > NOW() OR ${bayAreaTrafficEvents.endTime} IS NULL`);
    
    const total = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(bayAreaTrafficEvents);
    
    return {
      total: total[0]?.count || 0,
      active: activeCount[0]?.count || 0,
      byType: typeCounts,
      lastPoll: this.lastPollTime,
      lastPollStats: this.lastPollStats
    };
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}
