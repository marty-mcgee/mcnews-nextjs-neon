// src/lib/scripts/test-ckan-direct.ts
import axios from 'axios';

async function testCKANDirect() {
  console.log('🔍 Testing CKAN API directly...\n');
  
  const resourceId = 'b8ce0ca4-b4e9-490d-b4d1-1f4ec48cbefb';
  const url = 'https://data.ca.gov/api/3/action/datastore_search';
  
  try {
    // Test 1: Basic fetch with no filters
    console.log('Test 1: Basic fetch (limit 5, no filters)');
    const response1 = await axios.get(url, {
      params: {
        resource_id: resourceId,
        limit: 5,
        sort: 'Crash Date Time desc'
      }
    });
    
    console.log(`  Success: ${response1.data.success}`);
    console.log(`  Records count: ${response1.data.result?.records?.length || 0}`);
    if (response1.data.result?.records?.length > 0) {
      console.log(`  First record date: ${response1.data.result.records[0]['Crash Date Time']}`);
    }
    
    // Test 2: Check if there's any 2026 data at all
    console.log('\nTest 2: Checking for 2026 data (fetch 100 records)');
    const response2 = await axios.get(url, {
      params: {
        resource_id: resourceId,
        limit: 100,
        sort: 'Crash Date Time desc'
      }
    });
    
    const records2026 = response2.data.result?.records?.filter((r: any) => {
      const date = r['Crash Date Time'];
      return date && new Date(date).getFullYear() === 2026;
    }) || [];
    
    console.log(`  Total fetched: ${response2.data.result?.records?.length || 0}`);
    console.log(`  Records from 2026: ${records2026.length}`);
    
    if (records2026.length > 0) {
      console.log(`  Sample 2026 date: ${records2026[0]['Crash Date Time']}`);
    }
    
    // Test 3: Check the actual URL being called
    console.log('\nTest 3: URL being called');
    const params = new URLSearchParams({
      resource_id: resourceId,
      limit: '5',
      sort: 'Crash Date Time desc'
    });
    console.log(`  Full URL: ${url}?${params.toString()}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testCKANDirect();