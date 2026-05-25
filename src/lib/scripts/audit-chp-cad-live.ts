// src/lib/scripts/audit-chp-cad-live.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

async function auditCHPCADLive() {
  console.log('🔍 Auditing CHP CAD Live Scraper...\n');

  // 1. Total incidents
  const total = await db.execute(sql`
    SELECT COUNT(*) as count FROM chp_cad_incidents
  `);
  console.log(`📊 Total incidents: ${total.rows[0].count}`);

  // 2. By center (should show Ukiah and Humboldt only)
  const byCenter = await db.execute(sql`
    SELECT c.center_name, c.center_code, COUNT(i.id) as count
    FROM chp_cad_incidents i
    JOIN chp_cad_centers c ON i.center_id = c.id
    GROUP BY c.center_name, c.center_code
    ORDER BY count DESC
  `);
  console.log('\n📍 Incidents by center:');
  console.table(byCenter.rows);

  // 3. Last 24 hours activity
  const last24h = await db.execute(sql`
    SELECT COUNT(*) as count, MAX(created_at) as latest
    FROM chp_cad_incidents
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);
  console.log(`\n⏰ Last 24h: ${last24h.rows[0].count} new incidents`);
  console.log(`   Latest: ${last24h.rows[0].latest}`);

  // 4. Incident type distribution
  const byType = await db.execute(sql`
    SELECT incident_type, COUNT(*) as count
    FROM chp_cad_incidents
    GROUP BY incident_type
    ORDER BY count DESC
    LIMIT 10
  `);
  console.log('\n📋 Top incident types:');
  console.table(byType.rows);

  // 5. Check for stale poller (no data in 2 hours)
  const stale = await db.execute(sql`
    SELECT MAX(created_at) as last_poll FROM chp_cad_incidents
  `);
  const lastPoll = new Date(stale.rows[0]?.last_poll);
  const hoursSince = (Date.now() - lastPoll.getTime()) / (1000 * 60 * 60);
  console.log(`\n⏰ Hours since last poll: ${hoursSince.toFixed(1)}`);
  if (hoursSince > 2) {
    console.log('   ⚠️ Poller appears STALE - check cron job');
  } else {
    console.log('   ✅ Poller healthy');
  }
}

auditCHPCADLive();