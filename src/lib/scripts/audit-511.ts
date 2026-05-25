// src/lib/scripts/audit-511.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

async function audit511() {
  console.log('🔍 Auditing Bay Area 511 Poller...\n');

  // 1. Total events
  const total = await db.execute(sql`
    SELECT COUNT(*) as count FROM bay_area_traffic_events
  `);
  console.log(`📊 Total events in DB: ${total.rows[0].count}`);

  // 2. Active vs completed
  const status = await db.execute(sql`
    SELECT status, COUNT(*) as count FROM bay_area_traffic_events GROUP BY status
  `);
  console.log('\n📊 Status breakdown:');
  console.table(status.rows);

  // 3. By event type
  const byType = await db.execute(sql`
    SELECT event_type, COUNT(*) as count 
    FROM bay_area_traffic_events 
    GROUP BY event_type 
    ORDER BY count DESC 
    LIMIT 10
  `);
  console.log('\n📋 Top event types:');
  console.table(byType.rows);

  // 4. Last poll time
  const lastPoll = await db.execute(sql`
    SELECT MAX(fetched_at) as last_poll FROM bay_area_traffic_events
  `);
  const lastPollTime = lastPoll.rows[0]?.last_poll;
  const hoursSince = lastPollTime ? (Date.now() - new Date(lastPollTime).getTime()) / (1000 * 60 * 60) : null;
  console.log(`\n⏰ Last poll: ${lastPollTime}`);
  console.log(`   Hours since: ${hoursSince?.toFixed(1) || 'N/A'}`);
}

audit511();