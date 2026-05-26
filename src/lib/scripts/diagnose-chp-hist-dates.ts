// src/lib/scripts/diagnose-ckan-dates.ts
async function diagnoseCKANDates() {
  const resourceId = 'b8ce0ca4-b4e9-490d-b4d1-1f4ec48cbefb';
  const baseUrl = 'https://data.ca.gov/api/3/action/datastore_search';
  
  // Test 1: No date filter - just see what's available
  console.log('Test 1: No date filter, first 10 records');
  const res1 = await fetch(`${baseUrl}?resource_id=${resourceId}&limit=10&sort=Crash%20Date%20Time%20desc`);
  const data1 = await res1.json();
  console.log(`First record date: ${data1.result?.records[0]?.['Crash Date Time']}`);
  console.log(`Last record date in first page: ${data1.result?.records[data1.result.records.length-1]?.['Crash Date Time']}`);
  console.log(`Total records available: ${data1.result?.total}`);
  
  // Test 2: Try to get records from 2026-01-01 using a different approach
  console.log('\nTest 2: Using SQL query for 2026-01-01 onwards');
  const sqlUrl = 'https://data.ca.gov/api/3/action/datastore_search_sql';
  const sqlQuery = `SELECT * FROM "${resourceId}" WHERE "Crash Date Time" >= '2026-01-01' ORDER BY "Crash Date Time" ASC LIMIT 10`;
  const res2 = await fetch(`${sqlUrl}?sql=${encodeURIComponent(sqlQuery)}`);
  const data2 = await res2.json();
  console.log(`SQL query result count: ${data2.result?.records?.length || 0}`);
  if (data2.result?.records?.length > 0) {
    console.log(`First record date: ${data2.result.records[0]?.['Crash Date Time']}`);
  } else {
    console.log(`Error or no results: ${JSON.stringify(data2.error)}`);
  }
  
  // Test 3: Check what years are actually available
  console.log('\nTest 3: Checking available years in the dataset');
  const res3 = await fetch(`${baseUrl}?resource_id=${resourceId}&limit=1&sort=Crash%20Date%20Time%20asc`);
  const data3 = await res3.json();
  console.log(`Earliest record date: ${data3.result?.records[0]?.['Crash Date Time']}`);
  
  const res4 = await fetch(`${baseUrl}?resource_id=${resourceId}&limit=1&sort=Crash%20Date%20Time%20desc`);
  const data4 = await res4.json();
  console.log(`Latest record date: ${data4.result?.records[0]?.['Crash Date Time']}`);
}

diagnoseCKANDates();