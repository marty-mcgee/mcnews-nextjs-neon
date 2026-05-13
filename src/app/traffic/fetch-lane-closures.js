// caltrans-cwwp2.js
const axios = require('axios');

// All 12 Caltrans districts
const districts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

async function fetchLaneClosuresByDistrict(district) {
    const url = `https://cwwp2.dot.ca.gov/data/d${district}/lcs/lcsStatusD${district.toString().padStart(2, '0')}.json`;
    
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'CHP-Data-Collector/1.0' },
            timeout: 10000
        });
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            console.log(`No lane closure data for District ${district}`);
        } else {
            console.error(`Error fetching District ${district}:`, error.message);
        }
        return null;
    }
}

// Fetch all districts at once
async function fetchAllLaneClosures() {
    const results = {};
    
    for (const district of districts) {
        const data = await fetchLaneClosuresByDistrict(district);
        if (data) {
            results[`District_${district}`] = data;
            console.log(`✓ Fetched District ${district}`);
        }
        // Small delay to be respectful
        await new Promise(r => setTimeout(r, 100));
    }
    
    return results;
}

// Parse and display lane closure data
function parseLaneClosureData(data) {
    // Based on CWWP2 LCS documentation [citation:1]
    if (!data || !data.lcsClosures) {
        return [];
    }
    
    return data.lcsClosures.map(closure => ({
        district: closure.district,
        route: closure.route,           // Highway number (e.g., "I-5", "US-101")
        direction: closure.direction,    // "North", "South", "East", "West"
        closureType: closure.closureType,
        startDate: closure.startDate,
        endDate: closure.endDate,
        startTime: closure.startTime,
        endTime: closure.endTime,
        lanesAffected: closure.lanesAffected,
        description: closure.description,
        location: {
            latitude: closure.latitude,
            longitude: closure.longitude,
            county: closure.county,
            city: closure.city
        }
    }));
}

// Real-time execution
async function main() {
    console.log('🚦 Fetching Caltrans Lane Closure Data...\n');
    
    const allClosures = await fetchAllLaneClosures();
    
    // Count total closures
    let totalClosures = 0;
    for (const [district, data] of Object.entries(allClosures)) {
        const closures = data?.lcsClosures?.length || 0;
        totalClosures += closures;
        console.log(`${district}: ${closures} active lane closures`);
    }
    
    console.log(`\n📊 Total active lane closures across California: ${totalClosures}`);
    
    // Save to database
    await saveToDatabase(allClosures);
}

// Database storage function
async function saveToDatabase(data) {
    // Implementation depends on your database
    console.log('💾 Data ready for database storage');
}

main();
