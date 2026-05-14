// app/api/closures/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { laneClosures, caltransDistricts } from '@/lib/auth/schema';
import { eq, ilike, sql } from 'drizzle-orm';

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
    const sql = neon(connectionString);
    const db = drizzle(sql);
    
    let query = db
      .select({
        closureId: laneClosures.closureId,
        district: laneClosures.district,
        districtName: caltransDistricts.districtName,
        route: laneClosures.route,
        direction: laneClosures.direction,
        closureType: laneClosures.closureType,
        lanesAffected: laneClosures.lanesAffected,
        description: laneClosures.description,
        latitude: laneClosures.latitude,
        longitude: laneClosures.longitude,
        startDate: laneClosures.startDate,
        endDate: laneClosures.endDate,
        status: laneClosures.status,
        lastSeen: laneClosures.lastSeen,
        hoursRemaining: sql<number>`EXTRACT(EPOCH FROM (${laneClosures.endTimestamp} - NOW()))/3600`,
      })
      .from(laneClosures)
      .leftJoin(caltransDistricts, eq(laneClosures.district, caltransDistricts.districtId))
      .where(eq(laneClosures.status, status));
    
    if (district) {
      query = query.where(eq(laneClosures.district, parseInt(district)));
    }
    
    if (route) {
      query = query.where(ilike(laneClosures.route, `%${route}%`));
    }
    
    if (county) {
      query = query.where(eq(laneClosures.county, county));
    }
    
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
      { error: 'Failed to fetch closures' },
      { status: 500 }
    );
  }
}
