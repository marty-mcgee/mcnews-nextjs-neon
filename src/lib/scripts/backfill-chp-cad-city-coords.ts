// src/lib/scripts/backfill-chp-cad-city-coords.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import { getCityCoordinates } from '@/lib/utils/cityGeocoder';

async function backfillCHPCADCityCoords() {
  console.log('🔍 Backfilling CHP CAD with city coordinates...\n');
  
  // Get unique cities that need coordinates
  const cities = await db.execute(sql`
    SELECT DISTINCT city FROM chp_cad_incidents
    WHERE (latitude IS NULL OR longitude IS NULL)
      AND city IS NOT NULL AND city != ''
  `);
  
  console.log(`Found ${cities.rows.length} unique cities to geocode\n`);
  
  const cityCoordsMap: Record<string, { lat: number; lng: number }> = {};
  
  for (const row of cities.rows) {
    const city = row.city;
    console.log(`Geocoding: ${city}`);
    const coords = await getCityCoordinates(city);
    if (coords) {
      cityCoordsMap[city] = coords;
    }
    // Rate limiting is handled inside getCityCoordinates
  }
  
  // Update records by city
  for (const [city, coords] of Object.entries(cityCoordsMap)) {
    const result = await db.execute(sql`
      UPDATE chp_cad_incidents
      SET latitude = ${coords.lat}, longitude = ${coords.lng}
      WHERE city = ${city}
        AND (latitude IS NULL OR longitude IS NULL)
    `);
    console.log(`  Updated ${result.rowCount} records for ${city} → (${coords.lat}, ${coords.lng})`);
  }
  
  console.log('\n✅ Backfill complete!');
}

backfillCHPCADCityCoords().catch(console.error);