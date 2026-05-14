// app/api/closures/route.ts (Simplified - No Joins)
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { laneClosures } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const district = searchParams.get('district');
  const route = searchParams.get('route');
  const county = searchParams.get('county');
  const status = searchParams.get('status') || 'active';
  const limit = parseInt(searchParams.get('limit') || '100');
  
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sqlClient = neon(connectionString);
    const db = drizzle(sqlClient);
    
    // Build query incrementally
    let query = db.select().from(laneClosures);
    const conditions = [];
    
    if (status) {
      conditions.push(eq(laneClosures.status, status));
    }
    
    if (district) {
      conditions.push(eq(laneClosures.district, parseInt(district)));
    }
    
    if (route) {
      conditions.push(sql`${laneClosures.route} ILIKE ${`%${route}%`}`);
    }
    
    if (county) {
      conditions.push(eq(laneClosures.county, county));
    }
    
    // Apply all conditions
    if (conditions.length > 0) {
      query = query.where(conditions[0]);
      for (let i = 1; i < conditions.length; i++) {
        query = query.where(conditions[i]);
      }
    }
    
    // Add ordering and limit
    const closures = await query
      .orderBy(laneClosures.endDate)
      .limit(limit);
    
    return NextResponse.json({
      success: true,
      data: closures,
      meta: {
        total: closures.length,
        limit,
        filters: { district, route, county, status }
      }
    });
    
  } catch (error) {
    console.error('Query error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch closures', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
