// app/api/closures/export/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';
  const status = searchParams.get('status') || 'active';
  
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sql = neon(connectionString);
    
    const data = await sql`
      SELECT 
        closure_id,
        district,
        route,
        direction,
        closure_type,
        lanes_affected,
        description,
        city,
        county,
        start_date,
        end_date,
        status,
        created_at
      FROM lane_closures
      WHERE status = ${status}
      ORDER BY end_date ASC
    `;
    
    if (format === 'csv') {
      // Convert to CSV
      const headers = ['closure_id', 'district', 'route', 'direction', 'closure_type', 
                       'lanes_affected', 'description', 'city', 'county', 
                       'start_date', 'end_date', 'status', 'created_at'];
      
      const csvRows = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape quotes and wrap in quotes if contains comma
            const stringValue = String(value || '');
            if (stringValue.includes(',') || stringValue.includes('"')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          }).join(',')
        )
      ];
      
      const csv = csvRows.join('\n');
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=closures_${status}_${new Date().toISOString().split('T')[0]}.csv`
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      format,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}
