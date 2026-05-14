// app/api/closures/simple/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const district = searchParams.get('district');
  
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sql = neon(connectionString);
    
    let query = 'SELECT * FROM lane_closures';
    const params = [];
    
    if (district) {
      query += ' WHERE district = $1';
      params.push(parseInt(district));
    }
    
    query += ' LIMIT 10';
    
    const result = await sql(query, params);
    
    return NextResponse.json({
      success: true,
      data: result,
      count: result.length
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
