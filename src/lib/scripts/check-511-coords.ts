// src/lib/scripts/check-511-coords.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

async function check511Coords() {
  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as has_coords
    FROM bay_area_traffic_events
  `);
  
  console.log(`Bay Area 511: ${result.rows[0]?.total} total, ${result.rows[0]?.has_coords} with coordinates`);
}

check511Coords();