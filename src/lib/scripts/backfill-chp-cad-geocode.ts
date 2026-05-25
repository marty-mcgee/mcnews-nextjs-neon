// src/lib/scripts/geocode-chp-cad-backfill.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeLocation(location: string, city: string): Promise<{ lat: number; lng: number } | null> {
  // Build a better query string
  let query = location;
  if (city && city !== 'HM' && city !== 'UKIAH' && city !== 'HUMBOLDT') {
    query = `${location}, ${city}, California`;
  } else {
    query = `${location}, California`;
  }
  
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us&addressdetails=0`;
  
  try {
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'MCNews-Traffic-App/1.0 (contact@mcnews.com)'
      }
    });
    
    if (!response.ok) {
      console.error(`  HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data[0]) {
      return { 
        lat: parseFloat(data[0].lat), 
        lng: parseFloat(data[0].lon) 
      };
    }
    return null;
  } catch (error) {
    console.error(`  Geocoding error:`, error);
    return null;
  }
}

async function backfillCHPCADCoords() {
  console.log('🔍 Backfilling CHP CAD coordinates...\n');
  
  // Get records without coordinates
  const records = await db.execute(sql`
    SELECT id, location, city FROM chp_cad_incidents
    WHERE latitude IS NULL OR longitude IS NULL
    LIMIT 25
  `);
  
  console.log(`Found ${records.rows.length} records without coordinates\n`);
  
  let updated = 0;
  let failed = 0;
  
  for (let i = 0; i < records.rows.length; i++) {
    const record = records.rows[i];
    const locationText = record.location || '';
    const cityText = record.city || '';
    
    console.log(`[${i + 1}/${records.rows.length}] ${locationText.substring(0, 60)}`);
    
    const coords = await geocodeLocation(locationText, cityText);
    
    if (coords) {
      await db.execute(sql`
        UPDATE chp_cad_incidents
        SET latitude = ${coords.lat}, longitude = ${coords.lng}
        WHERE id = ${record.id}
      `);
      updated++;
      console.log(`  ✓ → (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
    } else {
      failed++;
      console.log(`  ✗ Could not geocode`);
    }
    
    // Respect Nominatim's usage policy: 1 request per second
    await sleep(1100);
  }
  
  console.log(`\n✅ Complete: ${updated} updated, ${failed} failed`);
  process.exit(0);
}

backfillCHPCADCoords().catch(console.error);