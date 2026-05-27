// src/lib/scripts/debug-calfire-full.ts
async function debugCalFireFull() {
  const url = 'https://incidents.fire.ca.gov/umbraco/api/IncidentApi/List?inactive=true';
  
  console.log('🔍 Fetching CalFire API (including inactive)...\n');
  
  const response = await fetch(url);
  const data = await response.json();
  
  console.log(`Total incidents returned: ${data.length}`);
  
  // Check if there's pagination metadata
  console.log('\n📋 Response structure:', Object.keys(data));
  
  // If it's an array, check the count
  if (Array.isArray(data)) {
    console.log(`\n✅ API returned ${data.length} incidents directly`);
    
    // Group by active status
    const active = data.filter((i: any) => i.IsActive === true);
    const inactive = data.filter((i: any) => i.IsActive === false);
    console.log(`Active: ${active.length}, Inactive: ${inactive.length}`);
  }
}

debugCalFireFull();