// src/app/api/collisions/stats/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { chpCollisions } from '@/lib/auth/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sqlClient = neon(connectionString);
    const db = drizzle(sqlClient);
    
    // Get counts by severity
    const bySeverity = await db
      .select({
        severity: chpCollisions.severity,
        count: sql<number>`COUNT(*)`,
        fatalities: sql<number>`SUM(${chpCollisions.fatalities})`,
        injuries: sql<number>`SUM(${chpCollisions.injuries})`,
      })
      .from(chpCollisions)
      .groupBy(chpCollisions.severity);
    
    // Get counts by county (top 10)
    const byCounty = await db
      .select({
        county: chpCollisions.county,
        count: sql<number>`COUNT(*)`,
      })
      .from(chpCollisions)
      .groupBy(chpCollisions.county)
      .orderBy(sql`count DESC`)
      .limit(10);
    
    // Get years available
    const years = await db
      .select({
        year: chpCollisions.collisionYear,
        count: sql<number>`COUNT(*)`,
      })
      .from(chpCollisions)
      .groupBy(chpCollisions.collisionYear)
      .orderBy(sql`year DESC`);
    
    // Get total counts
    const total = await db
      .select({
        count: sql<number>`COUNT(*)`,
        totalFatalities: sql<number>`SUM(${chpCollisions.fatalities})`,
        totalInjuries: sql<number>`SUM(${chpCollisions.injuries})`,
      })
      .from(chpCollisions);
    
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalCollisions: total[0]?.count || 0,
          totalFatalities: total[0]?.totalFatalities || 0,
          totalInjuries: total[0]?.totalInjuries || 0,
        },
        bySeverity,
        byCounty,
        availableYears: years.map(y => y.year),
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Collisions stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collision statistics' },
      { status: 500 }
    );
  }
}
