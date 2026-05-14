// app/api/poll/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { laneClosures, apiRequestLogs } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';
import axios from 'axios';

export const maxDuration = 60; // 60 seconds for serverless function
export const dynamic = 'force-dynamic';

// Polling lock to prevent concurrent runs
let isPolling = false;

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
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}

async function handlePoll() {
  if (isPolling) {
    return NextResponse.json(
      { error: 'Polling already in progress', status: 'busy' },
      { status: 409 }
    );
  }
  
  isPolling = true;
  const startTime = Date.now();
  
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sql = neon(connectionString);
    const db = drizzle(sql);
    
    const districts = (process.env.CALTRANS_DISTRICTS || '1,2,3,4,5,6,7,8,9,10,11,12')
      .split(',')
      .map(d => parseInt(d.trim()));
    
    let totalClosures = 0;
    const results: Record<number, number> = {};
    
    for (const district of districts) {
      // Add delay between districts
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const result = await fetchDistrictData(district, db);
      totalClosures += result.processed;
      results[district] = result.processed;
    }
    
    const duration = Date.now() - startTime;
    
    // Take snapshot on the hour
    const now = new Date();
    if (now.getMinutes() === 0) {
      await takeSnapshot(db);
    }
    
    return NextResponse.json({
      success: true,
      stats: {
        totalClosures,
        results,
        duration,
        timestamp: now.toISOString()
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
      return { processed: 0 };
    }
    
    console.log(`✓ District ${district}: ${response.data.lcsClosures.length} closures`);
    
    // Process closures
    let processed = 0;
    for (const closure of response.data.lcsClosures) {
      await upsertClosure(db, district, closure);
      processed++;
    }
    
    return { processed };
    
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
    return { processed: 0 };
  }
}

async function upsertClosure(db: any, district: number, closure: any) {
  const sourceId = closure.lcsClosureID || 
    `${district}_${closure.route}_${closure.startDate}_${closure.startTime}`;
  
  const startDate = closure.startDate || new Date().toISOString().split('T')[0];
  const endDate = closure.endDate || '2099-12-31';
  const startTime = closure.startTime || '00:00';
  const endTime = closure.endTime || '23:59';
  
  const status = determineStatus(closure);
  
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
  
  // Check if exists
  const existing = await db
    .select()
    .from(laneClosures)
    .where(eq(laneClosures.sourceId, sourceId))
    .limit(1);
  
  if (existing.length > 0) {
    // Update
    await db
      .update(laneClosures)
      .set({
        ...closureData,
        timesSeen: sql`${laneClosures.timesSeen} + 1`,
        lastModified: new Date(),
      })
      .where(eq(laneClosures.sourceId, sourceId));
    console.log(`  ↻ Updated ${sourceId}`);
  } else {
    // Insert
    await db.insert(laneClosures).values(closureData);
    console.log(`  ✨ New ${sourceId}`);
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
  const sql = neon(connectionString);
  const db = drizzle(sql);
  
  // Get active closures count
  const activeCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(laneClosures)
    .where(eq(laneClosures.status, 'active'));
  
  // Get API health
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
    active_closures: activeCount[0]?.count || 0,
    api_health: health[0],
    timestamp: new Date().toISOString()
  });
}

async function handleCleanup() {
  const connectionString = process.env.DATABASE_URL!;
  const sql = neon(connectionString);
  const db = drizzle(sql);
  
  // Archive old closures
  const archived = await db
    .update(laneClosures)
    .set({ status: 'completed' })
    .where(
      sql`${laneClosures.status} = 'active' AND ${laneClosures.endDate} < CURRENT_DATE - INTERVAL '7 days'`
    )
    .returning();
  
  // Delete old logs
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

async function takeSnapshot(db: any) {
  console.log('📸 Taking snapshot...');
  
  const stats = await db
    .select({
      district: laneClosures.district,
      totalClosures: sql<number>`COUNT(*)`,
      activeCount: sql<number>`COUNT(CASE WHEN ${laneClosures.status} = 'active' THEN 1 END)`,
      closuresByType: sql<any>`jsonb_agg(DISTINCT ${laneClosures.closureType})`,
      closuresByRoute: sql<any>`jsonb_agg(DISTINCT ${laneClosures.route})`,
    })
    .from(laneClosures)
    .groupBy(laneClosures.district);
  
  // Insert into snapshots table (you'll need to create this)
  // await db.insert(laneClosuresSnapshots).values(...);
  
  console.log(`✅ Snapshot recorded: ${stats.length} districts`);
}
