// src/app/api/chp-cad/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { chpCadIncidents } from '@/lib/auth/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const county = searchParams.get('county');
  const type = searchParams.get('type');
  const limit = parseInt(searchParams.get('limit') || '50');
  
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sqlClient = neon(connectionString);
    const db = drizzle(sqlClient);
    
    const conditions = [];
    if (county && county !== 'all') {
      conditions.push(eq(chpCadIncidents.county, county));
    }
    if (type && type !== 'all') {
      conditions.push(eq(chpCadIncidents.incidentType, type));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    let query;
    if (whereClause) {
      query = db
        .select()
        .from(chpCadIncidents)
        .where(whereClause)
        .orderBy(desc(chpCadIncidents.logTime))
        .limit(limit);
    } else {
      query = db
        .select()
        .from(chpCadIncidents)
        .orderBy(desc(chpCadIncidents.logTime))
        .limit(limit);
    }
    
    const incidents = await query;
    
    return NextResponse.json({
      success: true,
      data: incidents,
      count: incidents.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('CHP CAD query error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CHP incidents' },
      { status: 500 }
    );
  }
}
