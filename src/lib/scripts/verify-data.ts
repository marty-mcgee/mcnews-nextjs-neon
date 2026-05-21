// scripts/verify-data.ts
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function verifyData() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('Please make sure .env.local file exists with DATABASE_URL=...');
    process.exit(1);
  }
  
  const sql = neon(connectionString);
  
  console.log('🔍 Verifying database tables...\n');
  
  const tables = [
    { name: 'lane_closures', display: 'Caltrans Lane Closures' },
    { name: 'chp_collisions', display: 'CHP Historical Collisions' },
    { name: 'bay_area_traffic_events', display: 'Bay Area 511 Events' }
  ];
  
  for (const table of tables) {
    try {
      const result = await sql`SELECT COUNT(*) as count FROM ${sql(table.name)}`;
      console.log(`✅ ${table.display}: ${result[0].count} records`);
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        console.log(`⚠️ ${table.display}: Table not yet created (run migrations first)`);
      } else {
        console.log(`❌ ${table.display}: Error - ${error.message}`);
      }
    }
  }
  
  // Also check API logs table
  try {
    const logsResult = await sql`SELECT COUNT(*) as count FROM api_request_logs`;
    console.log(`\n📊 API Request Logs: ${logsResult[0].count} entries`);
  } catch (error) {
    console.log(`\n⚠️ API Request Logs: Table not yet created`);
  }
}

verifyData();