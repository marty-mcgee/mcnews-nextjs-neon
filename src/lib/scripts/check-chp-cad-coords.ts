// src/lib/scripts/check-chp-cad-coords.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

async function checkCHPCADCoords() {
  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as has_coords,
      COUNT(CASE WHEN latitude IS NULL OR longitude IS NULL THEN 1 END) as missing_coords
    FROM chp_cad_incidents
  `);
  
  console.log('CHP CAD Coordinates Status:');
  console.log(`  Total records: ${result.rows[0]?.total}`);
  console.log(`  Has coordinates: ${result.rows[0]?.has_coords}`);
  console.log(`  Missing coordinates: ${result.rows[0]?.missing_coords}`);
}

checkCHPCADCoords();