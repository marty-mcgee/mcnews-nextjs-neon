// src/lib/scripts/check-chp-database.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

async function checkCHPDatabase() {
  console.log('🔍 Checking CHP Collisions database...\n');
  
  // Total records
  const total = await db.execute(sql`SELECT COUNT(*) as count FROM chp_collisions`);
  console.log(`Total records in DB: ${total.rows[0]?.count}`);
  
  // Date range in DB
  const dateRange = await db.execute(sql`
    SELECT MIN(collision_date) as earliest, MAX(collision_date) as latest 
    FROM chp_collisions
  `);
  console.log(`Earliest date in DB: ${dateRange.rows[0]?.earliest}`);
  console.log(`Latest date in DB: ${dateRange.rows[0]?.latest}`);
  
  // By year
  const byYear = await db.execute(sql`
    SELECT collision_year, COUNT(*) as count 
    FROM chp_collisions 
    WHERE collision_year IS NOT NULL 
    GROUP BY collision_year 
    ORDER BY collision_year DESC
  `);
  console.log('\nRecords by year:');
  console.table(byYear.rows);
}

checkCHPDatabase();