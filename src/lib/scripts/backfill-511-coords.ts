// src/lib/scripts/backfill-511-coords.ts
import { db } from '@/lib/db/client';
import { bayAreaTrafficEvents } from '@/lib/auth/schema';
import { sql } from 'drizzle-orm';

async function backfill511Coords() {
  console.log('🔍 Backfilling Bay Area 511 coordinates from rawData...\n');
  
  // Get records without coordinates that have rawData
  const records = await db.execute(sql`
    SELECT id, raw_data FROM bay_area_traffic_events
    WHERE (latitude IS NULL OR longitude IS NULL)
      AND raw_data IS NOT NULL
    LIMIT 1000
  `);
  
  console.log(`Found ${records.rows.length} records to backfill\n`);
  
  let updated = 0;
  let failed = 0;
  
  for (const record of records.rows) {
    try {
      const rawData = typeof record.raw_data === 'string' 
        ? JSON.parse(record.raw_data) 
        : record.raw_data;
      
      let latitude = null;
      let longitude = null;
      
      // Extract from geography object
      if (rawData.geography?.coordinates) {
        const coords = rawData.geography.coordinates;
        if (Array.isArray(coords) && coords.length >= 2) {
          longitude = coords[0];
          latitude = coords[1];
        }
      }
      
      // Fallback to direct fields
      if (latitude === null && rawData.Latitude && rawData.Longitude) {
        latitude = rawData.Latitude;
        longitude = rawData.Longitude;
      }
      
      if (latitude === null && rawData.latitude && rawData.longitude) {
        latitude = rawData.latitude;
        longitude = rawData.longitude;
      }
      
      if (latitude !== null && longitude !== null) {
        await db.execute(sql`
          UPDATE bay_area_traffic_events
          SET latitude = ${latitude}, longitude = ${longitude}
          WHERE id = ${record.id}
        `);
        updated++;
        console.log(`  ✓ Updated record ${record.id}: (${latitude}, ${longitude})`);
      } else {
        failed++;
        console.log(`  ✗ No coordinates found in rawData for record ${record.id}`);
      }
      
    } catch (error) {
      failed++;
      console.error(`  ✗ Error processing record ${record.id}:`, error);
    }
  }
  
  console.log(`\n✅ Backfill complete: ${updated} updated, ${failed} failed`);
}

backfill511Coords().catch(console.error);