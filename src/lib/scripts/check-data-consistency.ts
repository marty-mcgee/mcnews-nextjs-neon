// src/lib/scripts/check-data-consistency.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

async function checkDataConsistency() {
  console.log('🔍 Checking data consistency across sources...\n');

  // Count records by source
  const sources = await db.execute(sql`
    SELECT 
      (SELECT COUNT(*) FROM chp_cad_incidents) as chp_cad_live,
      (SELECT COUNT(*) FROM chp_collisions) as chp_historical,
      (SELECT COUNT(*) FROM lane_closures) as caltrans,
      (SELECT COUNT(*) FROM bay_area_traffic_events) as bay_area_511
  `);
  console.log('📊 Record counts by source:');
  console.table(sources.rows);

  // Check for duplicate incidents across sources (by location/time)
  const duplicates = await db.execute(sql`
    SELECT 
      c.location,
      c.log_time,
      COUNT(*) as count
    FROM chp_cad_incidents c
    GROUP BY c.location, c.log_time
    HAVING COUNT(*) > 1
    LIMIT 10
  `);
  console.log('\n⚠️ Potential duplicates within CHP CAD:');
  console.table(duplicates.rows);
}

checkDataConsistency();