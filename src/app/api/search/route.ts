// app/api/closures/search/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '20');
  
  if (!q || q.length < 2) {
    return NextResponse.json({
      success: true,
      data: [],
      message: 'Search query must be at least 2 characters'
    });
  }
  
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sql = neon(connectionString);
    
    const results = await sql`
      SELECT 
        closure_id,
        route,
        closure_type,
        description,
        city,
        county,
        end_date,
        status,
        ts_rank(
          to_tsvector('english', COALESCE(description, '') || ' ' || COALESCE(route, '') || ' ' || COALESCE(city, '')),
          plainto_tsquery('english', ${q})
        ) as rank
      FROM lane_closures
      WHERE 
        status = 'active'
        AND (
          description ILIKE ${`%${q}%`}
          OR route ILIKE ${`%${q}%`}
          OR city ILIKE ${`%${q}%`}
          OR county ILIKE ${`%${q}%`}
        )
      ORDER BY rank DESC, end_date ASC
      LIMIT ${limit}
    `;
    
    return NextResponse.json({
      success: true,
      data: results,
      query: q,
      count: results.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
