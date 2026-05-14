// app/api/test/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export async function GET() {
  const connectionString = process.env.DATABASE_URL!;
  const sql = neon(connectionString);
  
  try {
    // Test 1: Count total closures
    const totalCount = await sql`SELECT COUNT(*) as count FROM lane_closures`;
    
    // Test 2: Count by status
    const statusCount = await sql`
      SELECT status, COUNT(*) as count 
      FROM lane_closures 
      GROUP BY status
    `;
    
    // Test 3: Get sample of 5 records
    const sample = await sql`SELECT * FROM lane_closures LIMIT 5`;
    
    // Test 4: Check district 7 specifically
    const district7 = await sql`SELECT COUNT(*) as count FROM lane_closures WHERE district = 7`;
    
    return NextResponse.json({
      success: true,
      totals: {
        all: totalCount[0].count,
        by_status: statusCount,
        district_7: district7[0].count
      },
      sample: sample,
      message: "If counts are 0, you need to run the poller first: npm run db:poll"
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
