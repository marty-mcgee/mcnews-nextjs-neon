// src/lib/scripts/compare-ui-vs-db.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

async function compareUIVsDB() {
  console.log('🔍 Comparing Database vs UI expectations...\n');

  // 1. CHP CAD Live - FIXED: specify which table's created_at
  const chpCad = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN i.status = 'active' THEN 1 END) as active,
      MAX(i.created_at) as newest,
      array_agg(DISTINCT c.center_name) as centers
    FROM chp_cad_incidents i
    JOIN chp_cad_centers c ON i.center_id = c.id
  `);
  console.log('📋 CHP CAD Live (should show on map):');
  console.log(`   Total incidents: ${chpCad.rows[0]?.total}`);
  console.log(`   Active incidents: ${chpCad.rows[0]?.active}`);
  console.log(`   Centers: ${chpCad.rows[0]?.centers?.join(', ')}`);
  console.log(`   Newest: ${chpCad.rows[0]?.newest}\n`);

  // 2. CHP Historical
  const chpHistorical = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN collision_year = 2026 THEN 1 END) as year_2026,
      MIN(collision_date) as oldest,
      MAX(collision_date) as newest
    FROM chp_collisions
  `);
  console.log('📋 CHP Historical (expected 2026 data):');
  console.log(`   Total collisions: ${chpHistorical.rows[0]?.total}`);
  console.log(`   From 2026: ${chpHistorical.rows[0]?.year_2026}`);
  console.log(`   Date range: ${chpHistorical.rows[0]?.oldest} to ${chpHistorical.rows[0]?.newest}\n`);

  // 3. Caltrans Lane Closures
  const caltrans = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      array_agg(DISTINCT district) as districts
    FROM lane_closures
    WHERE status = 'active'
  `);
  console.log('📋 Caltrans Lane Closures (active):');
  console.log(`   Active closures: ${caltrans.rows[0]?.active}`);
  console.log(`   Districts with closures: ${caltrans.rows[0]?.districts?.join(', ')}\n`);

  // 4. Bay Area 511
  const bayArea = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      array_agg(DISTINCT event_type) as types
    FROM bay_area_traffic_events
    WHERE status = 'active'
  `);
  console.log('📋 Bay Area 511 (active):');
  console.log(`   Active events: ${bayArea.rows[0]?.active}`);
  console.log(`   Event types: ${bayArea.rows[0]?.types?.slice(0, 5).join(', ')}...\n`);

  // 5. Check sample data from each source
  console.log('📝 Sample records (first 3 from each source):\n');

  const chpCadSample = await db.execute(sql`
    SELECT i.id, i.incident_type, i.location, i.city, c.center_name
    FROM chp_cad_incidents i
    JOIN chp_cad_centers c ON i.center_id = c.id
    ORDER BY i.created_at DESC
    LIMIT 3
  `);
  console.log('CHP CAD samples:');
  console.table(chpCadSample.rows);

  const chpHistoricalSample = await db.execute(sql`
    SELECT case_id, collision_date, severity, city, county
    FROM chp_collisions
    ORDER BY collision_date DESC
    LIMIT 3
  `);
  console.log('\nCHP Historical samples:');
  console.table(chpHistoricalSample.rows);

  const caltransSample = await db.execute(sql`
    SELECT closure_id, route, direction, closure_type, county, status
    FROM lane_closures
    WHERE status = 'active'
    ORDER BY last_seen DESC
    LIMIT 3
  `);
  console.log('\nCaltrans samples:');
  console.table(caltransSample.rows);

  const bayAreaSample = await db.execute(sql`
    SELECT id, event_type, roadway_name, status
    FROM bay_area_traffic_events
    WHERE status = 'active'
    ORDER BY fetched_at DESC
    LIMIT 3
  `);
  console.log('\nBay Area 511 samples:');
  console.table(bayAreaSample.rows);

  // 6. API route test instructions
  console.log('\n🔧 To check API routes manually, run these curls:\n');
  console.log('curl http://localhost:3000/api/chp-cad/poll?action=stats');
  console.log('curl http://localhost:3000/api/chp-historical/collisions/stats');
  console.log('curl http://localhost:3000/api/caltrans/closures/stats');
  console.log('curl http://localhost:3000/api/bay-area-511/poll?action=stats');
}

compareUIVsDB();