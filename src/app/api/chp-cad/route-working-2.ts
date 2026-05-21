// src/app/api/chp-cad/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { chpCadIncidents, chpCadCenters } from '@/lib/auth/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const centerId = searchParams.get('centerId');
  const county = searchParams.get('county');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sqlClient = neon(connectionString);
    const db = drizzle(sqlClient);
    
    // Build conditions array
    const conditions = [];
    if (centerId && centerId !== 'all') {
      conditions.push(eq(chpCadIncidents.centerId, parseInt(centerId)));
    }
    if (county && county !== 'all') {
      conditions.push(eq(chpCadIncidents.county, county));
    }
    
    // ✅ Using proper Drizzle pattern with whereClause
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    let countResult;
    if (whereClause) {
      countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(chpCadIncidents)
        .where(whereClause);
    } else {
      countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(chpCadIncidents);
    }
    const total = Number(countResult[0]?.count || 0);
    
    // Get incidents with center info
    let query = db
      .select({
        id: chpCadIncidents.id,
        sourceId: chpCadIncidents.sourceId,
        incidentType: chpCadIncidents.incidentType,
        location: chpCadIncidents.location,
        city: chpCadIncidents.city,
        county: chpCadIncidents.county,
        logTime: chpCadIncidents.logTime,
        details: chpCadIncidents.details,
        status: chpCadIncidents.status,
        centerName: chpCadCenters.centerName,
        centerCode: chpCadCenters.centerCode,
      })
      .from(chpCadIncidents)
      .leftJoin(chpCadCenters, eq(chpCadIncidents.centerId, chpCadCenters.id))
      .orderBy(desc(chpCadIncidents.logTime))
      .offset(offset)
      .limit(limit);
    
    if (whereClause) {
      query = query.where(whereClause);
    }
    
    const incidents = await query;
    
    return NextResponse.json({
      success: true,
      data: incidents,
      count: incidents.length,
      total: total,
      pagination: { limit, offset, hasMore: offset + limit < total },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('CHP CAD query error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CHP incidents', details: String(error) },
      { status: 500 }
    );
  }
}