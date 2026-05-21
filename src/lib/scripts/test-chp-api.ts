// scripts/test-chp-api.ts
import axios from 'axios';

async function testCHPAPI() {
  const resourceId = 'b8ce0ca4-b4e9-490d-b4d1-1f4ec48cbefb';
  const url = 'https://data.ca.gov/api/3/action/datastore_search';
  
  try {
    const response = await axios.get(url, {
      params: {
        resource_id: resourceId,
        limit: 5,
        offset: 0
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Has success:', response.data?.success);
    console.log('Has result:', !!response.data?.result);
    console.log('Records count:', response.data?.result?.records?.length);
    console.log('First record:', response.data?.result?.records?.[0]);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testCHPAPI();