// src/lib/services/BayArea511Poller.ts (Enhanced)
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
      
      const response = await axios.get(this.baseUrl, {
        params: {
          api_key: this.apiKey,
          format: 'json'
        },
        headers: { 'User-Agent': this.userAgent },
        timeout: 30000
      });
      
      // Extract events from response (handles both array and object responses)
      let events: any[] = [];
      if (Array.isArray(response.data)) {
        events = response.data;
      } else if (response.data?.events && Array.isArray(response.data.events)) {
        events = response.data.events;
      } else if (response.data?.Event && Array.isArray(response.data.Event)) {
        events = response.data.Event;
      } else {
        console.log('Unexpected API response format:', typeof response.data);
        events = [];
      }
      
      console.log(`  Fetched ${events.length} events from 511 API`);
      
      // Process events with enhanced extraction
      let newCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let mendocinoCount = 0;
      
      for (const event of events) {
        // Enhanced event data extraction
        const eventData = this.extractEventData(event);
        
        // Track Mendocino area events
        if (this.isMendocinoArea(eventData)) {
          mendocinoCount++;
        }
        
        const result = await this.upsertEvent(eventData);
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
        mendocinoEvents: mendocinoCount,
        duration 
      };
      
      console.log(`✅ Bay Area 511 Poll complete:`);
      console.log(`  Total: ${events.length} events`);
      console.log(`  New: ${newCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);
      console.log(`  Mendocino area: ${mendocinoCount} events`);
      
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

  private extractEventData(event: any): any {
    // Extract coordinates from various possible formats
    let latitude = null;
    let longitude = null;
    
    if (event.geography?.coordinates) {
      const coords = event.geography.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        longitude = coords[0];
        latitude = coords[1];
      }
    } else if (event.Latitude && event.Longitude) {
      latitude = event.Latitude;
      longitude = event.Longitude;
    } else if (event.latitude && event.longitude) {
      latitude = event.latitude;
      longitude = event.longitude;
    }
    
    // Extract roadway name
    let roadwayName = event.roadwayName || event.RoadwayName || event.roads?.[0]?.name || '';
    if (!roadwayName && event.location?.roadway) {
      roadwayName = event.location.roadway;
    }
    
    // Extract county/city
    let county = event.county || event.County || event.areas?.[0]?.name || '';
    let city = event.city || event.City || '';
    
    // Extract event type
    let eventType = event.event_type || event.EventType || event.type || '';
    
    // Extract description
    let description = event.description || event.Description || event.headline || '';
    
    // Extract severity
    let severity = event.severity || event.Severity || '';
    
    // Extract timestamps
    let startTime = event.startTime || event.StartDate || event.schedule?.intervals?.[0]?.split('/')[0] || null;
    let endTime = event.endTime || event.EndDate || event.schedule?.intervals?.[0]?.split('/')[1] || null;
    
    return {
      sourceId: event.id || event.ID || `511_${Date.now()}`,
      eventType,
      eventSubType: event.event_subtypes?.[0] || event.EventSubType,
      severity,
      status: event.status === 'ACTIVE' ? 'active' : 'inactive',
      title: description.substring(0, 200),
      description,
      roadwayName,
      directionOfTravel: event.directionOfTravel || event.DirectionOfTravel || event.roads?.[0]?.direction,
      lanesAffected: event.lanesAffected || event.LanesAffected || event.roads?.[0]?.state,
      isFullClosure: event.roads?.[0]?.state === 'CLOSED',
      latitude,
      longitude,
      county,
      city,
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      lastUpdated: event.updated ? new Date(event.updated) : new Date(),
      rawData: event,
    };
  }

  private isMendocinoArea(eventData: any): boolean {
    const mendocinoKeywords = [
      'mendocino', 'ukiah', 'fort bragg', 'willits', 'point arena', 
      'boonville', 'hopland', 'redwood valley', 'laytonville', 'covelo',
      '101', 'highway 1', '128', '20', '253', '271'
    ];
    
    const searchText = `${eventData.county || ''} ${eventData.city || ''} ${eventData.roadwayName || ''} ${eventData.description || ''}`.toLowerCase();
    return mendocinoKeywords.some(keyword => searchText.includes(keyword.toLowerCase()));
  }

  private async upsertEvent(eventData: any): Promise<'new' | 'updated' | 'skipped'> {
    try {
      const existing = await db
        .select()
        .from(bayAreaTrafficEvents)
        .where(eq(bayAreaTrafficEvents.sourceId, eventData.sourceId))
        .limit(1);
      
      if (existing.length > 0) {
        // Update if significant changes (status change or more than 12 hours old)
        const lastUpdate = existing[0].lastUpdated || existing[0].fetchedAt;
        const hoursSinceUpdate = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60);
        
        if (existing[0].status !== eventData.status || hoursSinceUpdate > 12) {
          await db
            .update(bayAreaTrafficEvents)
            .set({ ...eventData, updatedAt: new Date() })
            .where(eq(bayAreaTrafficEvents.sourceId, eventData.sourceId));
          return 'updated';
        }
        return 'skipped';
      } else {
        await db.insert(bayAreaTrafficEvents).values(eventData);
        return 'new';
      }
    } catch (error) {
      console.error(`Error upserting event ${eventData.sourceId}:`, error);
      return 'skipped';
    }
  }

  isPollingActive(): boolean {
    return this.pollingActive;
  }
}