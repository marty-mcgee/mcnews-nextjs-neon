// src/lib/scripts/debug-calfire-raw.ts
async function debugCalFire() {
  const url = 'https://incidents.fire.ca.gov/umbraco/api/IncidentApi/List?inactive=false';
  
  console.log('🔍 Fetching CalFire API...\n');
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`Total incidents in API: ${data.length}`);
    console.log('\n📋 All counties in response:');
    
    const counties = [...new Set(data.map((incident: any) => incident.County).filter(Boolean))];
    console.log(counties.sort());
    
    console.log('\n📋 Sample incident (first):');
    console.log(JSON.stringify(data[0], null, 2));
    
    console.log('\n📋 Northern California matches:');
    const northernCounties = [
      'Mendocino', 'Humboldt', 'Lake', 'Sonoma', 'Napa', 'Marin',
      'Solano', 'Contra Costa', 'Alameda', 'Santa Clara', 'San Mateo',
      'San Francisco', 'Sacramento', 'Yolo', 'Placer', 'El Dorado',
      'Butte', 'Tehama', 'Shasta', 'Siskiyou', 'Trinity', 'Del Norte'
    ];
    
    const matches = data.filter((incident: any) => 
      northernCounties.includes(incident.County)
    );
    
    console.log(`Found ${matches.length} incidents in Northern California counties`);
    
    if (matches.length > 0) {
      console.log('\nMatches:');
      matches.forEach((incident: any) => {
        console.log(`  - ${incident.Name} (${incident.County}) - ${incident.PercentContained}% contained`);
      });
    } else {
      console.log('\n⚠️ No matches found. Check county name spelling in API response.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugCalFire();