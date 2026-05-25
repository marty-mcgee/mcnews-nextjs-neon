// src/app/api/chp-historical/collisions/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { chpCollisions } from '@/lib/auth/schema';
import { sql, desc, eq, or, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const LOCAL_COUNTY_CODES = ['12', '23']; // Humboldt, Mendocino

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '2000');
  const offset = parseInt(searchParams.get('offset') || '0');
  const showAll = searchParams.get('showAll') === 'true';
  
  try {
    let conditions: any = [];
    
    if (!showAll) {
      // Filter to local counties only
      conditions = [inArray(chpCollisions.county, LOCAL_COUNTY_CODES)];
    }
    
    const collisions = await db
      .select()
      .from(chpCollisions)
      .where(conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined)
      .orderBy(desc(chpCollisions.collisionDate))
      .limit(limit)
      .offset(offset);
    
    // Get total count
    let totalConditions: any = [];
    if (!showAll) {
      totalConditions = [inArray(chpCollisions.county, LOCAL_COUNTY_CODES)];
    }
    
    const totalResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chpCollisions)
      .where(totalConditions.length > 0 ? sql.join(totalConditions, sql` AND `) : undefined);
    
    return NextResponse.json({
      success: true,
      data: collisions,
      count: collisions.length,
      total: totalResult[0]?.count || 0,
      showAll: showAll,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('CHP Historical API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}