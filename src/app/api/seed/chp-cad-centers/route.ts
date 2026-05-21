// src/app/api/seed/chp-cad-centers/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { chpCadCenters } from '@/lib/auth/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const CHP_CAD_CENTERS = [
  // Bay Area Region
  { centerCode: 'CC', centerName: 'Contra Costa', county: 'Contra Costa', region: 'Bay Area' },
  { centerCode: 'GG', centerName: 'Golden Gate', county: 'San Francisco', region: 'Bay Area' },
  { centerCode: 'SCL', centerName: 'Santa Clara', county: 'Santa Clara', region: 'Bay Area' },
  { centerCode: 'SM', centerName: 'San Mateo', county: 'San Mateo', region: 'Bay Area' },
  { centerCode: 'SOL', centerName: 'Solano', county: 'Solano', region: 'Bay Area' },
  
  // Southern Region
  { centerCode: 'LA', centerName: 'Los Angeles', county: 'Los Angeles', region: 'Southern' },
  { centerCode: 'ORA', centerName: 'Orange', county: 'Orange', region: 'Southern' },
  { centerCode: 'RIV', centerName: 'Riverside', county: 'Riverside', region: 'Southern' },
  { centerCode: 'SBD', centerName: 'San Bernardino', county: 'San Bernardino', region: 'Southern' },
  { centerCode: 'SD', centerName: 'San Diego', county: 'San Diego', region: 'Southern' },
  { centerCode: 'VEN', centerName: 'Ventura', county: 'Ventura', region: 'Southern' },
  
  // Central Region
  { centerCode: 'FRE', centerName: 'Fresno', county: 'Fresno', region: 'Central' },
  { centerCode: 'KERN', centerName: 'Kern', county: 'Kern', region: 'Central' },
  { centerCode: 'SJ', centerName: 'San Joaquin', county: 'San Joaquin', region: 'Central' },
  { centerCode: 'SLO', centerName: 'San Luis Obispo', county: 'San Luis Obispo', region: 'Central' },
  { centerCode: 'STA', centerName: 'Stanislaus', county: 'Stanislaus', region: 'Central' },
  
  // Northern Region
  { centerCode: 'BUTT', centerName: 'Butte', county: 'Butte', region: 'Northern' },
  { centerCode: 'EUREKA', centerName: 'Eureka', county: 'Humboldt', region: 'Northern' },
  { centerCode: 'MEND', centerName: 'Mendocino', county: 'Mendocino', region: 'Northern' },
  { centerCode: 'RED', centerName: 'Redding', county: 'Shasta', region: 'Northern' },
  { centerCode: 'SAC', centerName: 'Sacramento', county: 'Sacramento', region: 'Northern' },
  { centerCode: 'SON', centerName: 'Sonoma', county: 'Sonoma', region: 'Northern' },
  { centerCode: 'UKI', centerName: 'Ukiah', county: 'Mendocino', region: 'Northern' },
  { centerCode: 'YOLO', centerName: 'Yolo', county: 'Yolo', region: 'Northern' },
];

export async function GET() {
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sqlClient = neon(connectionString);
    const db = drizzle(sqlClient);
    
    let inserted = 0;
    let skipped = 0;
    
    for (const center of CHP_CAD_CENTERS) {
      // ✅ Using correct Drizzle pattern - build whereClause
      const conditions = [eq(chpCadCenters.centerCode, center.centerCode)];
      const whereClause = and(...conditions);
      
      const existing = await db
        .select()
        .from(chpCadCenters)
        .where(whereClause)
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(chpCadCenters).values(center);
        inserted++;
        console.log(`✓ Inserted ${center.centerName}`);
      } else {
        skipped++;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'CHP CAD Centers seeded',
      stats: { inserted, skipped, total: CHP_CAD_CENTERS.length }
    });
    
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}