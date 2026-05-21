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
  }

  async fetchEvents() {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(this.baseUrl, {
        params: { api_key: this.apiKey, format: 'json' },
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000
      });
      
      const events = Array.isArray(response.data) ? response.data : [];
      
      await this.logApiRequest({
        endpoint: this.baseUrl,
        responseTimeMs: Date.now() - startTime,
        statusCode: response.status,
        success: true,
        recordsFetched: events.length
      });
      
      return events;
    } catch (error) {
      console.error('511 API failed:', error);
      return [];
    }
  }

  private async logApiRequest(logData: any) {
    try {
      await db.insert(apiRequestLogs).values(logData);
    } catch (error) {
      console.error('Failed to log:', error);
    }
  }

  private async upsertEvent(event: any): Promise<'new' | 'updated' | 'skipped'> {
    const sourceId = event.ID || `511_${Date.now()}`;
    
    const eventData = {
      sourceId: String(sourceId),
      eventType: event.EventType,
      severity: event.Severity,
      description: event.Description,
      roadwayName: event.RoadwayName,
      directionOfTravel: event.DirectionOfTravel,
      lanesAffected: event.LanesAffected,
      latitude: event.Latitude ? Number(event.Latitude) : null,
      longitude: event.Longitude ? Number(event.Longitude) : null,
      rawData: event,
    };
    
    const existing = await db
      .select()
      .from(bayAreaTrafficEvents)
      .where(eq(bayAreaTrafficEvents.sourceId, String(sourceId)))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(bayAreaTrafficEvents).values(eventData);
      return 'new';
    }
    return 'skipped';
  }

  async pollAll(): Promise<{ success: boolean; stats?: any }> {
    if (this.pollingActive) return { success: false };
    
    this.pollingActive = true;
    const startTime = Date.now();
    
    try {
      const events = await this.fetchEvents();
      let newCount = 0;
      
      for (const event of events) {
        const result = await this.upsertEvent(event);
        if (result === 'new') newCount++;
      }
      
      this.lastPollStats = { totalFetched: events.length, newCount, duration: Date.now() - startTime };
      this.lastPollTime = new Date();
      
      return { success: true, stats: this.lastPollStats };
    } finally {
      this.pollingActive = false;
    }
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}