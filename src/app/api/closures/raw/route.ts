// app/api/closures/raw/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export async function GET() {
  const connectionString = process.env.DATABASE_URL!;
  const sql = neon(connectionString);
  
  try {
    const records = await sql`SELECT * FROM lane_closures`;
    
    return NextResponse.json({
      success: true,
      count: records.length,
      data: records,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Raw query error:', error);
    return NextResponse.json(
      { 
        error: 'Raw query failed', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
