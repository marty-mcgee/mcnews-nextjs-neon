// src/lib/scripts/diagnose-chp-cad.ts
import { db } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

async function diagnoseCHPCAD() {
  console.log('🔍 Diagnosing CHP CAD tables...\n');

  // List all tables in your database
  const tables = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  console.log('📋 Available tables:');
  console.table(tables.rows.map(t => t.table_name));

  // Look for CHP CAD related tables
  const chpTables = tables.rows.filter(t => 
    t.table_name.toLowerCase().includes('chp') || 
    t.table_name.toLowerCase().includes('cad')
  );

  console.log('\n🔎 CHP/CAD related tables:');
  console.table(chpTables);
}

diagnoseCHPCAD();