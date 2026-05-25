// src/lib/scripts/check-511-data.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

async function check511Data() {
  console.log('🔍 Checking Bay Area 511 data in database...\n');
  
  // 1. Total records
  const total = await db.execute(sql`
    SELECT COUNT(*) as total FROM bay_area_traffic_events
  `);
  console.log(`Total records: ${total.rows[0]?.total}`);
  
  // 2. Records with coordinates
  const withCoords = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as has_coords
    FROM bay_area_traffic_events
  `);
  console.log(`Records with coordinates: ${withCoords.rows[0]?.has_coords}`);
  
  // 3. Status breakdown
  const byStatus = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM bay_area_traffic_events
    GROUP BY status
  `);
  console.log('\nStatus breakdown:');
  console.table(byStatus.rows);
  
  // 4. Sample records (first 3)
  const samples = await db.execute(sql`
    SELECT id, event_type, roadway_name, status, latitude, longitude
    FROM bay_area_traffic_events
    LIMIT 5
  `);
  console.log('\nSample records:');
  console.table(samples.rows);
  
  // 5. Most recent fetch
  const recent = await db.execute(sql`
    SELECT MAX(fetched_at) as last_fetch
    FROM bay_area_traffic_events
  `);
  console.log(`\nLast fetch time: ${recent.rows[0]?.last_fetch}`);
}

check511Data().catch(console.error);