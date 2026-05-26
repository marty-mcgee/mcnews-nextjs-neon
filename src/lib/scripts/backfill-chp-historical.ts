// src/lib/scripts/backfill-chp-historical.ts
import { db } from '@/lib/db/client';
import { chpCollisions } from '@/lib/auth/schema';
import { eq } from 'drizzle-orm';

async function backfillCHPHistorical() {
  const resourceId = 'b8ce0ca4-b4e9-490d-b4d1-1f4ec48cbefb';
  const baseUrl = 'https://data.ca.gov/api/3/action/datastore_search';
  
  console.log('🚦 Starting CHP Historical BACKFILL...\n');
  
  let offset = 0;
  const batchSize = 500;
  let totalProcessed = 0;
  let totalInserted = 0;
  let hasMore = true;
  
  while (hasMore) {
    console.log(`Fetching batch ${Math.floor(offset / batchSize) + 1} (offset: ${offset})...`);
    
    const url = new URL(baseUrl);
    url.searchParams.append('resource_id', resourceId);
    url.searchParams.append('limit', String(batchSize));
    url.searchParams.append('offset', String(offset));
    url.searchParams.append('sort', 'Crash Date Time asc');
    
    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'MCNews-Backfill/1.0' }
    });
    
    if (!response.ok) {
      console.error(`HTTP ${response.status}`);
      break;
    }
    
    const data = await response.json();
    const records = data.result?.records || [];
    
    if (records.length === 0) {
      hasMore = false;
      break;
    }
    
    // Filter for local counties (Humboldt = 12, Mendocino = 23)
    const localCounties = ['12', '23'];
    const localRecords = records.filter((record: any) => 
      localCounties.includes(String(record['County Code']))
    );
    
    let batchInserted = 0;
    for (const record of localRecords) {
      const caseId = record['Report Number'];
      if (!caseId) continue;
      
      const existing = await db
        .select()
        .from(chpCollisions)
        .where(eq(chpCollisions.caseId, caseId))
        .limit(1);
      
      if (existing.length === 0) {
        const collisionDate = record['Crash Date Time'] ? new Date(record['Crash Date Time']) : null;
        
        await db.insert(chpCollisions).values({
          caseId: caseId,
          collisionDate: collisionDate,
          collisionYear: collisionDate?.getFullYear() || null,
          severity: record['Collision Type Description'] || 'Unknown',
          county: record['County Code'] ? String(record['County Code']) : null,
          city: record['City Name'],
          location: record['Primary Road'] || '',
          latitude: record['Latitude'] ? parseFloat(record['Latitude']) : null,
          longitude: record['Longitude'] ? parseFloat(record['Longitude']) : null,
          primaryFactor: record['Primary Collision Factor Violation'],
          weather: record['Weather 1'],
          lighting: record['LightingDescription'],
          injuries: record['NumberInjured'] || 0,
          fatalities: record['NumberKilled'] || 0,
          rawData: record,
          lastSeen: new Date(),
        });
        batchInserted++;
        totalInserted++;
      }
    }
    
    totalProcessed += records.length;
    console.log(`  Batch: ${records.length} fetched, ${batchInserted} inserted (total: ${totalInserted}/${totalProcessed})`);
    
    offset += batchSize;
    
    if (records.length < batchSize) {
      hasMore = false;
    }
    
    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log(`\n✅ Backfill complete!`);
  console.log(`  Total records processed: ${totalProcessed}`);
  console.log(`  Total new records inserted: ${totalInserted}`);
  
  process.exit(0);
}

backfillCHPHistorical().catch(console.error);