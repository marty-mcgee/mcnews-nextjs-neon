// src/app/api/collisions/stats/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { chpCollisions } from '@/lib/auth/schema';
import { sql, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const connectionString = process.env.DATABASE_URL!;
  const sqlClient = neon(connectionString);
  const db = drizzle(sqlClient);
  
  try {
    // Check if table exists first
    const tableExists = await sqlClient`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'chp_collisions'
      )
    `;
    
    if (!tableExists[0]?.exists) {
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalCollisions: 0,
            totalFatalities: 0,
            totalInjuries: 0,
          },
          bySeverity: [],
          byCounty: [],
          availableYears: [],
        },
        message: 'CHP collisions table not created yet. Run migrations first.',
      });
    }
    
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
      .orderBy(desc(chpCollisions.collisionYear));
    
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
          totalCollisions: Number(total[0]?.count || 0),
          totalFatalities: Number(total[0]?.totalFatalities || 0),
          totalInjuries: Number(total[0]?.totalInjuries || 0),
        },
        bySeverity: bySeverity.map(s => ({
          ...s,
          count: Number(s.count),
          fatalities: Number(s.fatalities),
          injuries: Number(s.injuries),
        })),
        byCounty: byCounty.map(c => ({
          ...c,
          count: Number(c.count),
        })),
        availableYears: years.map(y => y.year).filter(y => y),
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Collisions stats error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch collision statistics',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
