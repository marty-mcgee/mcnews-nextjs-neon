// src/lib/scripts/audit-caltrans.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

async function auditCaltrans() {
  console.log('🔍 Auditing Caltrans CWWP2 Poller...\n');

  // 1. Total closures
  const total = await db.execute(sql`
    SELECT COUNT(*) as count FROM lane_closures
  `);
  console.log(`📊 Total lane closures in DB: ${total.rows[0].count}`);

  // 2. Active vs completed
  const status = await db.execute(sql`
    SELECT status, COUNT(*) as count FROM lane_closures GROUP BY status
  `);
  console.log('\n📊 Status breakdown:');
  console.table(status.rows);

  // 3. By district
  const byDistrict = await db.execute(sql`
    SELECT district, COUNT(*) as count 
    FROM lane_closures 
    WHERE status = 'active'
    GROUP BY district 
    ORDER BY district
  `);
  console.log('\n📍 Active closures by district:');
  console.table(byDistrict.rows);

  // 4. Recently updated (last hour)
  const recent = await db.execute(sql`
    SELECT COUNT(*) as count, MAX(last_seen) as last_seen
    FROM lane_closures 
    WHERE last_seen > NOW() - INTERVAL '1 hour'
  `);
  console.log(`\n⏰ Active in last hour: ${recent.rows[0].count}`);
  console.log(`   Last seen: ${recent.rows[0].last_seen}`);

  // 5. Stale closures (not seen in 30 min)
  const stale = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM lane_closures 
    WHERE status = 'active' AND last_seen < NOW() - INTERVAL '30 minutes'
  `);
  console.log(`\n⚠️ Stale active closures (not seen >30min): ${stale.rows[0].count}`);

  // 6. Missing coordinates
  const missingCoords = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM lane_closures 
    WHERE latitude IS NULL OR longitude IS NULL
  `);
  console.log(`\n📍 Closures missing coordinates: ${missingCoords.rows[0].count}`);
}

auditCaltrans();