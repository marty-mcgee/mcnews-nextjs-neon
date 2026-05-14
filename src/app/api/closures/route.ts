// app/api/closures/route.ts (Enhanced)
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
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const sortBy = searchParams.get('sortBy') || 'endDate';
  const sortOrder = searchParams.get('sortOrder') || 'ASC';
  
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sqlClient = neon(connectionString);
    const db = drizzle(sqlClient);
    
    // Build query
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
    
    // Apply conditions
    if (conditions.length > 0) {
      query = query.where(conditions[0]);
      for (let i = 1; i < conditions.length; i++) {
        query = query.where(conditions[i]);
      }
    }
    
    // Get total count
    let countQuery = db.select({ count: sql<number>`COUNT(*)` }).from(laneClosures);
    if (conditions.length > 0) {
      countQuery = countQuery.where(conditions[0]);
      for (let i = 1; i < conditions.length; i++) {
        countQuery = countQuery.where(conditions[i]);
      }
    }
    const totalResult = await countQuery;
    const total = Number(totalResult[0]?.count || 0);
    
    // Apply sorting
    const sortColumn = sortBy === 'endDate' ? laneClosures.endDate : 
                      sortBy === 'startDate' ? laneClosures.startDate :
                      sortBy === 'createdAt' ? laneClosures.createdAt :
                      laneClosures.endDate;
    
    const orderedQuery = sortOrder === 'DESC' 
      ? query.orderBy(sql`${sortColumn} DESC`)
      : query.orderBy(sql`${sortColumn} ASC`);
    
    // Apply pagination
    const closures = await orderedQuery.offset(offset).limit(limit);
    
    // Enhance with calculated fields
    const closuresWithMeta = closures.map(closure => ({
      ...closure,
      hoursRemaining: closure.endTimestamp 
        ? Math.max(0, (new Date(closure.endTimestamp).getTime() - Date.now()) / (1000 * 60 * 60))
        : null,
      isExpiringSoon: closure.endTimestamp 
        ? (new Date(closure.endTimestamp).getTime() - Date.now()) < (24 * 60 * 60 * 1000)
        : false,
      daysRemaining: closure.endTimestamp
        ? Math.max(0, (new Date(closure.endTimestamp).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null
    }));
    
    return NextResponse.json({
      success: true,
      data: closuresWithMeta,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        totalPages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1
      },
      meta: {
        filters: { district, route, county, status },
        sort: { sortBy, sortOrder },
        timestamp: new Date().toISOString()
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
