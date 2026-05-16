// src/app/api/collisions/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { chpCollisions } from '@/lib/auth/schema';
import { eq, and, ilike, sql, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const county = searchParams.get('county');
  const severity = searchParams.get('severity');
  const year = searchParams.get('year');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sqlClient = neon(connectionString);
    const db = drizzle(sqlClient);
    
    // Build conditions
    const conditions = [];
    
    if (county && county !== 'all') {
      conditions.push(eq(chpCollisions.county, county));
    }
    
    if (severity && severity !== 'all') {
      conditions.push(eq(chpCollisions.severity, severity));
    }
    
    if (year && year !== 'all') {
      conditions.push(eq(chpCollisions.collisionYear, parseInt(year)));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    let countResult;
    if (whereClause) {
      countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(chpCollisions)
        .where(whereClause);
    } else {
      countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(chpCollisions);
    }
    const total = Number(countResult[0]?.count || 0);
    
    // Get paginated results
    let query;
    if (whereClause) {
      query = db
        .select()
        .from(chpCollisions)
        .where(whereClause)
        .orderBy(desc(chpCollisions.collisionDate))
        .offset(offset)
        .limit(limit);
    } else {
      query = db
        .select()
        .from(chpCollisions)
        .orderBy(desc(chpCollisions.collisionDate))
        .offset(offset)
        .limit(limit);
    }
    
    const collisions = await query;
    
    return NextResponse.json({
      success: true,
      data: collisions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      filters: { county, severity, year },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Collisions query error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collisions' },
      { status: 500 }
    );
  }
}
