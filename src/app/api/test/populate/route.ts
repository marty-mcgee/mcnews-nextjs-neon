// app/api/test/populate/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export async function GET() {
  const connectionString = process.env.DATABASE_URL!;
  const sql = neon(connectionString);
  
  try {
    // Check record count
    const count = await sql`SELECT COUNT(*) as count FROM lane_closures`;
    
    // If no records, add a test record
    if (Number(count[0].count) === 0) {
      await sql`
        INSERT INTO lane_closures (source_id, district, route, closure_type, description, start_date, end_date, status)
        VALUES ('test_1', 7, 'I-405', 'Construction', 'Test closure for debugging', CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', 'active')
      `;
      return NextResponse.json({ 
        message: 'No data found. Added a test record. Run the poller to get real data.',
        record_count: 0
      });
    }
    
    return NextResponse.json({ 
      message: 'Data exists in database',
      record_count: Number(count[0].count)
    });
    
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
