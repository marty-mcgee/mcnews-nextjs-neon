// app/api/dashboard/stats/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sql = neon(connectionString);
    
    // Get all stats in parallel
    const [
      totalActive,
      totalCompleted,
      uniqueRoutes,
      closuresLast24h,
      districtStats,
      recentActivity
    ] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM lane_closures WHERE status = 'active'`,
      sql`SELECT COUNT(*) as count FROM lane_closures WHERE status = 'completed'`,
      sql`SELECT COUNT(DISTINCT route) as count FROM lane_closures WHERE status = 'active'`,
      sql`SELECT COUNT(*) as count FROM lane_closures WHERE created_at > NOW() - INTERVAL '24 hours'`,
      sql`
        SELECT 
          district,
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active
        FROM lane_closures
        GROUP BY district
        ORDER BY district
      `,
      sql`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as new_closures
        FROM lane_closures
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `
    ]);
    
    return NextResponse.json({
      success: true,
      data: {
        overview: {
          total_active: Number(totalActive[0]?.count || 0),
          total_completed: Number(totalCompleted[0]?.count || 0),
          unique_routes: Number(uniqueRoutes[0]?.count || 0),
          new_last_24h: Number(closuresLast24h[0]?.count || 0)
        },
        by_district: districtStats,
        weekly_trend: recentActivity,
        last_updated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
