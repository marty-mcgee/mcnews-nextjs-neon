// src/lib/scripts/audit-chp-cad.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import { chpCadIncidents, chpCadCenters } from '@/lib/auth/schema';

async function auditCHPCAD() {
  console.log('🔍 Auditing CHP CAD data quality...\n');

  // 1. Total record count
  const total = await db.execute(sql`
    SELECT COUNT(*) as count FROM chp_cad_incidents
  `);
  console.log(`📊 Total incidents in database: ${total.rows[0].count}\n`);

  // 2. Incidents by Center (using your relations)
  const byCenter = await db.execute(sql`
    SELECT 
      c.center_name,
      c.center_code,
      COUNT(i.id) as incident_count,
      MAX(i.created_at) as last_seen
    FROM chp_cad_incidents i
    LEFT JOIN chp_cad_centers c ON i.center_id = c.id
    GROUP BY c.id, c.center_name, c.center_code
    ORDER BY incident_count DESC
  `);
  
  console.log('📍 Incidents by CHP Communication Center:');
  console.table(byCenter.rows);

  // 3. Check for missing location data (using your actual column names)
  const missingLocation = await db.execute(sql`
    SELECT 
      COUNT(CASE WHEN location IS NULL OR location = '' THEN 1 END) as missing_location,
      COUNT(CASE WHEN city IS NULL OR city = '' THEN 1 END) as missing_city,
      COUNT(CASE WHEN county IS NULL OR county = '' THEN 1 END) as missing_county
    FROM chp_cad_incidents
  `);
  
  console.log('\n📍 Missing Location Data:');
  console.table(missingLocation.rows);

  // 4. Check for missing timestamps
  const missingTimes = await db.execute(sql`
    SELECT 
      COUNT(CASE WHEN log_time IS NULL THEN 1 END) as missing_log_time,
      COUNT(CASE WHEN created_at IS NULL THEN 1 END) as missing_created_at
    FROM chp_cad_incidents
  `);
  
  console.log('\n⏰ Missing Timestamps:');
  console.table(missingTimes.rows);

  // 5. Check for stale polling
  const lastIncident = await db.execute(sql`
    SELECT MAX(log_time) as last_incident_time, MAX(fetched_at) as last_fetch
    FROM chp_cad_incidents
  `);
  
  const lastFetch = lastIncident.rows[0]?.last_fetch;
  console.log(`\n⏰ Last fetch time: ${lastFetch}`);
  
  if (lastFetch) {
    const hoursSinceFetch = (new Date().getTime() - new Date(lastFetch).getTime()) / (1000 * 60 * 60);
    console.log(`   Hours since last poll: ${hoursSinceFetch.toFixed(1)}`);
    if (hoursSinceFetch > 2) {
      console.log(`   ⚠️ WARNING: Poller appears stale!`);
    } else {
      console.log(`   ✅ Poller appears healthy`);
    }
  }

  // 6. Sample of recent incidents
  const recent = await db.execute(sql`
    SELECT 
      i.id,
      i.incident_type,
      i.location,
      i.city,
      c.center_name,
      i.log_time
    FROM chp_cad_incidents i
    LEFT JOIN chp_cad_centers c ON i.center_id = c.id
    ORDER BY i.log_time DESC NULLS LAST
    LIMIT 5
  `);
  
  console.log('\n📋 5 Most Recent Incidents:');
  console.table(recent.rows);

  // 7. Incidents by type distribution
  const byType = await db.execute(sql`
    SELECT 
      incident_type,
      COUNT(*) as count
    FROM chp_cad_incidents
    WHERE incident_type IS NOT NULL
    GROUP BY incident_type
    ORDER BY count DESC
    LIMIT 10
  `);
  
  console.log('\n📊 Top 10 Incident Types:');
  console.table(byType.rows);

  // 8. Check for orphaned records (center_id points to non-existent center)
  const orphaned = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM chp_cad_incidents i
    LEFT JOIN chp_cad_centers c ON i.center_id = c.id
    WHERE i.center_id IS NOT NULL AND c.id IS NULL
  `);
  
  console.log(`\n🔗 Orphaned incidents (missing center): ${orphaned.rows[0].count}`);

  // 9. Centers with no incidents
  const inactiveCenters = await db.execute(sql`
    SELECT c.center_name, c.center_code
    FROM chp_cad_centers c
    LEFT JOIN chp_cad_incidents i ON c.id = i.center_id
    WHERE i.id IS NULL AND c.is_active = true
    LIMIT 10
  `);
  
  if (inactiveCenters.rows.length > 0) {
    console.log('\n⚠️ Active centers with no incidents:');
    console.table(inactiveCenters.rows);
  }
}

auditCHPCAD();