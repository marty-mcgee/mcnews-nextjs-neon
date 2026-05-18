// src/app/api/debug/all-polls/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export async function GET() {
  const connectionString = process.env.DATABASE_URL!;
  const sql = neon(connectionString);
  
  const results: any = {
    timestamp: new Date().toISOString(),
    tables: {},
    env_vars: {},
    recent_logs: []
  };
  
  try {
    // 1. Check each table for records
    const tables = ['lane_closures', 'chp_collisions', 'bay_area_traffic_events', 'chp_cad_incidents'];
    
    for (const table of tables) {
      try {
        const countResult = await sql`SELECT COUNT(*) as count FROM ${sql(table)}`;
        results.tables[table] = { 
          exists: true, 
          count: Number(countResult[0]?.count || 0)
        };
      } catch (error: any) {
        results.tables[table] = { 
          exists: false, 
          error: error.message 
        };
      }
    }
    
    // 2. Get sample records from tables that have data
    for (const [table, info] of Object.entries(results.tables)) {
      if (info.exists && info.count > 0) {
        try {
          const samples = await sql`SELECT * FROM ${sql(table)} LIMIT 2`;
          results.tables[table].sample = samples;
        } catch (error: any) {
          results.tables[table].sample_error = error.message;
        }
      }
    }
    
    // 3. Check API logs for recent activity
    try {
      const logs = await sql`
        SELECT endpoint, success, records_fetched, request_timestamp 
        FROM api_request_logs 
        ORDER BY request_timestamp DESC 
        LIMIT 10
      `;
      results.recent_logs = logs;
    } catch (error: any) {
      results.recent_logs_error = error.message;
    }
    
    // 4. Check environment variables (without exposing sensitive data)
    results.env_vars = {
      has_districts: !!process.env.CALTRANS_DISTRICTS,
      has_511_key: !!process.env.BAY_AREA_511_API_KEY,
      has_db_url: !!process.env.DATABASE_URL,
      node_env: process.env.NODE_ENV || 'not set'
    };
    
    return NextResponse.json(results);
    
  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { 
        error: 'Debug failed', 
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
