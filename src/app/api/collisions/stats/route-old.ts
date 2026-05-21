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
    
    // Total counts
    const total = await db
      .select({
        count: sql<number>`COUNT(*)`,
        totalFatalities: sql<number>`SUM(${chpCollisions.fatalities})`,
        totalInjuries: sql<number>`SUM(${chpCollisions.injuries})`,
      })
      .from(chpCollisions);
    
    // By severity
    const bySeverity = await db
      .select({
        severity: chpCollisions.severity,
        count: sql<number>`COUNT(*)`,
        fatalities: sql<number>`SUM(${chpCollisions.fatalities})`,
        injuries: sql<number>`SUM(${chpCollisions.injuries})`,
      })
      .from(chpCollisions)
      .groupBy(chpCollisions.severity);
    
    // Top counties
    const byCounty = await db
      .select({
        county: chpCollisions.county,
        count: sql<number>`COUNT(*)`,
      })
      .from(chpCollisions)
      .where(sql`${chpCollisions.county} IS NOT NULL`)
      .groupBy(chpCollisions.county)
      .orderBy(sql`count DESC`)
      .limit(10);
    
    // Available years
    const years = await db
      .select({
        year: chpCollisions.collisionYear,
        count: sql<number>`COUNT(*)`,
      })
      .from(chpCollisions)
      .where(sql`${chpCollisions.collisionYear} IS NOT NULL`)
      .groupBy(chpCollisions.collisionYear)
      .orderBy(sql`year DESC`);
    
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalCollisions: Number(total[0]?.count || 0),
          totalFatalities: Number(total[0]?.totalFatalities || 0),
          totalInjuries: Number(total[0]?.totalInjuries || 0),
        },
        bySeverity: bySeverity.map(s => ({
          severity: s.severity,
          count: Number(s.count),
          fatalities: Number(s.fatalities || 0),
          injuries: Number(s.injuries || 0),
        })),
        byCounty: byCounty.map(c => ({
          county: c.county,
          count: Number(c.count),
        })),
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