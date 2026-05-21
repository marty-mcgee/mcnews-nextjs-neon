// src/app/api/bay-area-traffic/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { bayAreaTrafficEvents } from '@/lib/auth/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventType = searchParams.get('eventType');
  const status = searchParams.get('status') || 'active';
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sqlClient = neon(connectionString);
    const db = drizzle(sqlClient);
    
    const conditions = [];
    if (eventType && eventType !== 'all') {
      conditions.push(eq(bayAreaTrafficEvents.eventType, eventType));
    }
    if (status && status !== 'all') {
      conditions.push(eq(bayAreaTrafficEvents.status, status));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    let query;
    if (whereClause) {
      query = db
        .select()
        .from(bayAreaTrafficEvents)
        .where(whereClause)
        .orderBy(desc(bayAreaTrafficEvents.startTime))
        .offset(offset)
        .limit(limit);
    } else {
      query = db
        .select()
        .from(bayAreaTrafficEvents)
        .orderBy(desc(bayAreaTrafficEvents.startTime))
        .offset(offset)
        .limit(limit);
    }
    
    const events = await query;
    
    return NextResponse.json({
      success: true,
      data: events,
      count: events.length,
      pagination: { limit, offset },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Bay Area traffic query error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Bay Area traffic events' },
      { status: 500 }
    );
  }
}
