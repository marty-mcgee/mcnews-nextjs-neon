// app/api/poll/route.ts (Fixed TypeScript Errors)
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { laneClosures, apiRequestLogs } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';
import axios from 'axios';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

let isPolling = false;
let lastPollTime: Date | null = null;
let lastPollStats: any = null;

interface ClosureData {
  sourceId: string;
  district: number;
  route: string;
  direction: string;
  closureType: string;
  lanesAffected: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  startTimestamp: Date;
  endTimestamp: Date;
  description: string;
  latitude: number | null;
  longitude: number | null;
  county: string | null;
  city: string | null;
  status: 'active' | 'completed' | 'cancelled';
  rawData: any;
  lastSeen: Date;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'poll';
  
  switch (action) {
    case 'poll':
      return handlePoll();
    case 'status':
      return handleStatus();
    case 'cleanup':
      return handleCleanup();
    case 'stats':
      return handlePollStats();
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}

async function handlePoll() {
  if (isPolling) {
    return NextResponse.json(
      { error: 'Polling already in progress', status: 'busy', lastPoll: lastPollTime },
      { status: 409 }
    );
  }
  
  isPolling = true;
  const startTime = Date.now();
  
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sqlClient = neon(connectionString);
    const db = drizzle(sqlClient);
    
    const districts = (process.env.CALTRANS_DISTRICTS || '1,2,3,4,5,6,7,8,9,10,11,12')
      .split(',')
      .map(d => parseInt(d.trim()));
    
    let totalClosures = 0;
    let totalNew = 0;
    let totalUpdated = 0;
    const results: Record<number, { processed: number; new: number; updated: number }> = {};
    
    for (const district of districts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const result = await fetchDistrictData(district, db);
      totalClosures += result.processed;
      totalNew += result.new;
      totalUpdated += result.updated;
      results[district] = result;
    }
    
    const duration = Date.now() - startTime;
    lastPollTime = new Date();
    lastPollStats = { totalClosures, totalNew, totalUpdated, results, duration };
    
    return NextResponse.json({
      success: true,
      stats: {
        totalClosures,
        totalNew,
        totalUpdated,
        results,
        duration,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Polling error:', error);
    return NextResponse.json(
      { error: 'Polling failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  } finally {
    isPolling = false;
  }
}

async function fetchDistrictData(district: number, db: any) {
  const startTime = Date.now();
  const url = `https://cwwp2.dot.ca.gov/data/d${district}/lcs/lcsStatusD${district.toString().padStart(2, '0')}.json`;
  
  try {
    console.log(`[${new Date().toISOString()}] Fetching district ${district}...`);
    
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Caltrans-Poller/1.0 (contact@example.com)' },
      timeout: 15000,
      validateStatus: (status) => status === 200 || status === 404
    });
    
    const responseTime = Date.now() - startTime;
    
    // Log API request
    await db.insert(apiRequestLogs).values({
      endpoint: url,
      district,
      responseTimeMs: responseTime,
      statusCode: response.status,
      success: response.status === 200,
      recordsFetched: response.data?.lcsClosures?.length || 0,
      responseSizeBytes: JSON.stringify(response.data).length
    });
    
    if (response.status === 404 || !response.data?.lcsClosures) {
      console.log(`No data for District ${district}`);
      return { processed: 0, new: 0, updated: 0 };
    }
    
    console.log(`✓ District ${district}: ${response.data.lcsClosures.length} closures`);
    
    let processed = 0;
    let newCount = 0;
    let updatedCount = 0;
    
    for (const closure of response.data.lcsClosures) {
      const result = await upsertClosure(db, district, closure);
      processed++;
      if (result === 'new') newCount++;
      if (result === 'updated') updatedCount++;
    }
    
    return { processed, new: newCount, updated: updatedCount };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await db.insert(apiRequestLogs).values({
      endpoint: url,
      district,
      responseTimeMs: responseTime,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
    
    console.error(`✗ District ${district} failed:`, error);
    return { processed: 0, new: 0, updated: 0 };
  }
}

async function upsertClosure(db: any, district: number, closure: any): Promise<'new' | 'updated' | 'skipped'> {
  const sourceId = closure.lcsClosureID || 
    `${district}_${closure.route}_${closure.startDate}_${closure.startTime}`;
  
  const startDate = closure.startDate || new Date().toISOString().split('T')[0];
  const endDate = closure.endDate || '2099-12-31';
  const startTime = closure.startTime || '00:00';
  const endTime = closure.endTime || '23:59';
  
  const status = determineStatus(closure);
  
  const closureData: ClosureData = {
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
  
  // Check if exists
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
          status: closureData.status,
          description: closureData.description,
          lanesAffected: closureData.lanesAffected,
          endDate: closureData.endDate,
          endTime: closureData.endTime,
          endTimestamp: closureData.endTimestamp,
          lastSeen: closureData.lastSeen,
          timesSeen: sql`${laneClosures.timesSeen} + 1`,
          rawData: closureData.rawData,
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

function determineStatus(closure: any): 'active' | 'completed' | 'cancelled' {
  if (closure.status === 'cancelled') return 'cancelled';
  
  if (closure.endDate) {
    const endDateTime = new Date(`${closure.endDate}T${closure.endTime || '23:59'}`);
    if (endDateTime < new Date()) {
      return 'completed';
    }
  }
  
  return 'active';
}

async function handleStatus() {
  const connectionString = process.env.DATABASE_URL!;
  const sqlClient = neon(connectionString);
  const db = drizzle(sqlClient);
  
  const statusCounts = await db
    .select({
      status: laneClosures.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(laneClosures)
    .groupBy(laneClosures.status);
  
  const activeByDistrict = await db
    .select({
      district: laneClosures.district,
      count: sql<number>`COUNT(*)`,
    })
    .from(laneClosures)
    .where(eq(laneClosures.status, 'active'))
    .groupBy(laneClosures.district)
    .orderBy(laneClosures.district);
  
  const health = await db
    .select({
      totalRequests: sql<number>`COUNT(*)`,
      avgResponseTime: sql<number>`AVG(${apiRequestLogs.responseTimeMs})`,
      successRate: sql<number>`(SUM(CASE WHEN ${apiRequestLogs.success} THEN 1 ELSE 0 END)::float / COUNT(*)::float) * 100`,
      lastRequest: sql<Date>`MAX(${apiRequestLogs.requestTimestamp})`,
    })
    .from(apiRequestLogs)
    .where(sql`${apiRequestLogs.requestTimestamp} > NOW() - INTERVAL '24 hours'`);
  
  return NextResponse.json({
    success: true,
    stats: {
      status_counts: statusCounts,
      active_by_district: activeByDistrict,
      total_active: activeByDistrict.reduce((sum, d) => sum + (Number(d.count) || 0), 0),
    },
    api_health: health[0],
    last_poll: lastPollTime,
    last_poll_stats: lastPollStats,
    timestamp: new Date().toISOString()
  });
}

async function handleCleanup() {
  const connectionString = process.env.DATABASE_URL!;
  const sqlClient = neon(connectionString);
  const db = drizzle(sqlClient);
  
  const archived = await db
    .update(laneClosures)
    .set({ status: 'completed' })
    .where(
      sql`${laneClosures.status} = 'active' AND ${laneClosures.endDate} < CURRENT_DATE - INTERVAL '7 days'`
    )
    .returning();
  
  const deleted = await db
    .delete(apiRequestLogs)
    .where(sql`${apiRequestLogs.requestTimestamp} < NOW() - INTERVAL '30 days'`)
    .returning();
  
  return NextResponse.json({
    success: true,
    message: 'Cleanup completed',
    archived_count: archived.length,
    deleted_logs: deleted.length
  });
}

async function handlePollStats() {
  return NextResponse.json({
    success: true,
    last_poll: lastPollTime,
    last_poll_stats: lastPollStats,
    is_polling: isPolling
  });
}
