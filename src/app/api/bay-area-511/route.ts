// src/app/api/bay-area-511/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { bayAreaTrafficEvents } from '@/lib/auth/schema';
import { desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '500');
  const offset = parseInt(searchParams.get('offset') || '0');
  const eventType = searchParams.get('eventType');
  
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sqlClient = neon(connectionString);
    const db = drizzle(sqlClient);
    
    // Build conditions
    let query = db.select().from(bayAreaTrafficEvents);
    
    if (eventType && eventType !== 'all') {
      query = query.where(sql`${bayAreaTrafficEvents.eventType} = ${eventType}`);
    }
    
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(bayAreaTrafficEvents);
    const total = Number(countResult[0]?.count || 0);
    
    // Get paginated results
    const events = await query
      .orderBy(desc(bayAreaTrafficEvents.createdAt))
      .offset(offset)
      .limit(limit);
    
    return NextResponse.json({
      success: true,
      data: events,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Bay Area 511 query error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Bay Area events', details: String(error) },
      { status: 500 }
    );
  }
}