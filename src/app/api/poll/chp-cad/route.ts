// src/app/api/poll/chp-cad/route.ts
import { NextResponse } from 'next/server';
import { CHPCADPoller } from '@/lib/services/CHPCADPoller';
import { db } from '@/lib/db/client';
import { chpCadIncidents } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

let isPolling = false;
let lastPollTime: Date | null = null;
let lastPollStats: any = null;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'poll';
  
  try {
    switch (action) {
      case 'poll':
        return await handlePoll();
      case 'status':
        return await handleStatus();
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('CHP CAD API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
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
    const poller = new CHPCADPoller();
    const result = await poller.pollAllCounties();
    
    const duration = Date.now() - startTime;
    lastPollTime = new Date();
    lastPollStats = { ...result, duration };
    
    return NextResponse.json({
      success: true,
      stats: lastPollStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('CHP CAD polling error:', error);
    return NextResponse.json(
      { error: 'Polling failed', details: String(error) },
      { status: 500 }
    );
  } finally {
    isPolling = false;
  }
}

async function handleStatus() {
  try {
    // Get recent incident counts - handle case where table doesn't exist yet
    let recentCount = 0;
    try {
      const result = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(chpCadIncidents)
        .where(sql`${chpCadIncidents.fetchedAt} > NOW() - INTERVAL '24 hours'`);
      recentCount = result[0]?.count || 0;
    } catch (dbError) {
      console.log('CHP CAD table may not exist yet:', dbError);
    }
    
    return NextResponse.json({
      success: true,
      isPolling,
      lastPollTime,
      lastPollStats,
      recentIncidents24h: recentCount,
    });
  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json(
      { error: 'Failed to get status', details: String(error) },
      { status: 500 }
    );
  }
}
