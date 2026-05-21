// src/app/api/debug/verify-data/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export async function GET() {
  const connectionString = process.env.DATABASE_URL!;
  const sql = neon(connectionString);
  
  const results: any = {};
  
  const tables = ['lane_closures', 'chp_collisions', 'bay_area_traffic_events'];
  
  for (const table of tables) {
    try {
      const result = await sql`SELECT COUNT(*) as count FROM ${sql(table)}`;
      results[table] = { exists: true, count: Number(result[0]?.count || 0) };
    } catch (error: any) {
      results[table] = { exists: false, error: error.message };
    }
  }
  
  return NextResponse.json({
    success: true,
    tables: results,
    timestamp: new Date().toISOString()
  });
}