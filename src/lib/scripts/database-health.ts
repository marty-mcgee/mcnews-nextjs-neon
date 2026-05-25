// src/lib/scripts/database-health.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

async function databaseHealth() {
  console.log('🔍 Database Health Check...\n');

  // 1. Table sizes
  const sizes = await db.execute(sql`
    SELECT 
      relname as table_name,
      pg_size_pretty(pg_total_relation_size(relid)) as total_size
    FROM pg_catalog.pg_statio_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
  `);
  console.log('📊 Table sizes:');
  console.table(sizes.rows);

  // 2. Index usage - CORRECTED column names for pg_stat_user_indexes
  const indexes = await db.execute(sql`
    SELECT 
      schemaname,
      relname as tablename,
      indexrelname as indexname,
      idx_scan as scans
    FROM pg_stat_user_indexes
    ORDER BY idx_scan DESC
    LIMIT 10
  `);
  console.log('\n📊 Most used indexes:');
  console.table(indexes.rows);

  // 3. Unused indexes - CORRECTED column names
  const unused = await db.execute(sql`
    SELECT 
      schemaname,
      relname as tablename,
      indexrelname as indexname,
      idx_scan as scans
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0
  `);
  console.log(`\n📊 Unused indexes: ${unused.rows.length}`);
  if (unused.rows.length > 0) {
    console.table(unused.rows.slice(0, 10));
  }

  // 4. Table bloat estimate - CORRECTED column names for pg_stat_user_tables
  const bloat = await db.execute(sql`
    SELECT 
      schemaname,
      relname as tablename,
      n_live_tup as live_rows,
      n_dead_tup as dead_rows
    FROM pg_stat_user_tables
    WHERE n_dead_tup > 1000
    ORDER BY n_dead_tup DESC
  `);
  console.log('\n⚠️ Tables with dead rows > 1000:');
  if (bloat.rows.length > 0) {
    console.table(bloat.rows);
  } else {
    console.log('   None found - good!');
  }

  // 5. Last vacuum/analyze times - CORRECTED column names
  const vacuum = await db.execute(sql`
    SELECT 
      schemaname,
      relname as tablename,
      last_vacuum,
      last_autovacuum,
      last_analyze,
      last_autoanalyze
    FROM pg_stat_user_tables
    ORDER BY last_autovacuum DESC NULLS LAST
    LIMIT 10
  `);
  console.log('\n🧹 Last vacuum/analyze times:');
  console.table(vacuum.rows);

  // 6. Cache hit ratio
  const cacheHit = await db.execute(sql`
    SELECT 
      sum(heap_blks_read) as heap_read,
      sum(heap_blks_hit) as heap_hit,
      round(sum(heap_blks_hit) * 100.0 / nullif(sum(heap_blks_hit + heap_blks_read), 0), 2) as cache_hit_ratio
    FROM pg_statio_user_tables
  `);
  console.log('\n💾 Cache hit ratio:');
  console.log(`   ${cacheHit.rows[0]?.cache_hit_ratio || 'N/A'}%`);

  // 7. Active connections
  const connections = await db.execute(sql`
    SELECT count(*) as active_connections
    FROM pg_stat_activity
    WHERE state = 'active'
  `);
  console.log(`\n🔌 Active connections: ${connections.rows[0]?.active_connections}`);

  // 8. Database size
  const dbSize = await db.execute(sql`
    SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
  `);
  console.log(`\n💿 Total database size: ${dbSize.rows[0]?.db_size}`);
}

databaseHealth().catch(console.error);