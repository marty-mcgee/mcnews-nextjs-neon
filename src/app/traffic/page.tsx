// "use client"

import Image from "next/image";
import Link from "next/link";
import { NavBar } from "@/components/navbar";
import { checkDbConnection } from "@/lib/db/client";

// caltrans-cwwp2.js
// const axios = require('axios');
import axios from "axios";

// All 12 Caltrans districts
// const districts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const districts = [1];

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
      console.debug(`No lane closure data for District ${district}`);
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
      console.debug(`✓ Fetched District ${district}`);
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
// async function main() {
//     console.debug('🚦 Fetching Caltrans Lane Closure Data...\n');
    
//     const allClosures = await fetchAllLaneClosures();
    
//     // Count total closures
//     let totalClosures = 0;
//     for (const [district, data] of Object.entries(allClosures)) {
//         const closures = data?.lcsClosures?.length || 0;
//         totalClosures += closures;
//         console.debug(`${district}: ${closures} active lane closures`);
//     }
    
//     console.debug(`\n📊 Total active lane closures across California: ${totalClosures}`);
    
//     // Save to database
//     await saveToDatabase(allClosures);
// }

// Database storage function
async function saveToDatabase(data) {
    // Implementation depends on your database
    console.debug('💾 Data ready for database storage');
}

// main();

// Fetch CCTV camera information
async function fetchCCTVData() {
  const url = 'https://cwwp2.dot.ca.gov/data/d1/cctv/cctvStatusD01.json';
  
  const response = await axios.get(url);
  const data = response.data.data;
  console.debug(data.length);

  // // Parse CCTV data based on field documentation [citation:5]
  // const cameras = data.map(cctv => ({
  //   index: cctv.index,
  //   locationName: cctv.location.locationName,
  //   nearbyPlace: cctv.location.nearbyPlace,
  //   county: cctv.location.county,
  //   route: cctv.location.route,
  //   direction: cctv.location.direction,
  //   coordinates: {
  //     latitude: cctv.location.latitude,
  //     longitude: cctv.location.longitude,
  //     elevation: cctv.location.elevation
  //   },
  //   inService: cctv.inService === 'true',
  //   imageURL: cctv.imageData?.static?.currentImageURL,
  //   lastUpdated: `${cctv.recordTimestamp.recordDate} ${cctv.recordTimestamp.recordTime}`
  // }));
  
  // console.debug(`Found ${cameras.length} CCTV cameras`);
  
  // return cameras;
  return null;
}


// chp-collision-api.js
// const axios = require('axios');

// CKAN API endpoints
const CKAN_API = 'https://data.ca.gov/api/3/action';
const RESOURCE_ID = 'b8ce0ca4-b4e9-490d-b4d1-1f4ec48cbefb'; // CCRS Collision Data

// Fetch collision records with filters
async function fetchCollisions(options = {}) {
    const {
        limit = 100,
        offset = 0,
        county = null,
        year = null,
        severity = null
    } = options;
    
    // Build filters
    const filters = {};
    if (county) filters.county_name = county;
    if (year) filters.collision_year = year;
    if (severity) filters.collision_severity = severity;
    
    const params = {
        resource_id: RESOURCE_ID,
        limit: limit,
        offset: offset,
        filters: JSON.stringify(filters)
    };
    
    try {
        const response = await axios.get(`${CKAN_API}/datastore_search`, { params });
        
        if (response.data.success) {
            return {
                records: response.data.result.records,
                total: response.data.result.total,
                limit: response.data.result.limit,
                offset: response.data.result.offset
            };
        } else {
            throw new Error(response.data.error?.message || 'Unknown error');
        }
    } catch (error) {
        console.error('API Error:', error.message);
        return null;
    }
}

// Fetch all records for a county with pagination
async function fetchAllCollisionsByCounty(county, limit = 100) {
    let allRecords = [];
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
        console.debug(`Fetching ${county} records - offset: ${offset}`);
        
        const result = await fetchCollisions({
            county: county,
            limit: limit,
            offset: offset
        });
        
        if (!result || !result.records.length) {
            hasMore = false;
        } else {
            allRecords = allRecords.concat(result.records);
            offset += limit;
            hasMore = result.records.length === limit;
        }
        
        // Small delay between pagination requests
        await new Promise(r => setTimeout(r, 200));
    }
    
    console.debug(`Total ${county} collisions: ${allRecords.length}`);
    return allRecords;
}

// Parse and transform collision data
function parseCollisionRecord(record) {
    return {
        caseId: record.case_id,
        collisionDate: record.collision_date,
        collisionTime: record.collision_time,
        collisionYear: record.collision_year,
        severity: record.collision_severity,  // Fatal, Injury, Property Damage
        location: {
            city: record.city,
            county: record.county_name,
            address: record.primary_road,
            secondaryRoad: record.secondary_road,
            latitude: record.latitude,
            longitude: record.longitude
        },
        conditions: {
            weather: record.weather_1,
            lighting: record.primary_road_lighting,
            roadSurface: record.road_surface
        },
        parties: {
            number_of_parties: record.number_of_parties,
            number_of_fatalities: record.number_of_fatalities,
            number_of_injuries: record.number_injured
        },
        vehicleTypes: record.type_of_vehicle,
        factors: {
            primary_factor: record.primary_collision_factor,
            contributing: record.contributing_factor_1
        }
    };
}

// Query by geographic area
async function getCollisionsByCoordinates(lat, lon, radiusMiles = 5) {
    // First fetch recent collisions, then filter by distance
    const result = await fetchCollisions({ limit: 1000 });
    
    if (!result) return [];
    
    const filtered = result.records.filter(record => {
        if (!record.latitude || !record.longitude) return false;
        const distance = calculateDistance(lat, lon, record.latitude, record.longitude);
        return distance <= radiusMiles;
    });
    
    return filtered.map(parseCollisionRecord);
}

// Helper: Haversine distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Get collision statistics by county
async function getCountyStatistics(county) {
    const result = await fetchCollisions({ county: county, limit: 5000 });
    
    if (!result) return null;
    
    const stats = {
        county: county,
        totalCollisions: result.total,
        bySeverity: {
            fatal: result.records.filter(r => r.collision_severity === 'Fatal').length,
            injury: result.records.filter(r => r.collision_severity === 'Injury').length,
            propertyDamage: result.records.filter(r => r.collision_severity === 'Property Damage').length
        },
        topFactors: {},
        monthlyTrends: {}
    };
    
    // Analyze primary collision factors
    const factors = {};
    result.records.forEach(r => {
        if (r.primary_collision_factor) {
            factors[r.primary_collision_factor] = (factors[r.primary_collision_factor] || 0) + 1;
        }
    });
    stats.topFactors = Object.entries(factors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    return stats;
}

// Example usage
async function demonstrateAPI() {
    console.debug('📊 CHP Collision Data API Demo\n');
    
    // 1. Fetch recent collisions for Mendocino County
    console.debug('1. Recent Mendocino collisions:');
    const laCollisions = await fetchCollisions({
        county: 'Mendocino',
        limit: 5
    });
    console.debug(`   Found ${laCollisions?.total || 0} total collisions`);
    if (laCollisions?.records) {
        laCollisions.records.slice(0, 3).forEach(c => {
            console.debug(`   - ${c.collision_date}: ${c.collision_severity} on ${c.primary_road}`);
        });
    }
    
    console.debug('\n2. County statistics for Mendocino County:');
    const ocStats = await getCountyStatistics('Mendocino');
    if (ocStats) {
        console.debug(`   Total collisions: ${ocStats.totalCollisions}`);
        console.debug(`   Fatal: ${ocStats.bySeverity.fatal}`);
        console.debug(`   Injury: ${ocStats.bySeverity.injury}`);
    }
    
    console.debug('\n3. Collisions near Fort Bragg:');
    const sfCollisions = await getCollisionsByCoordinates(37.7749, -122.4194, 3);
    console.debug(`   Found ${sfCollisions.length} collisions within 3 miles of FB`);
}

// Uncomment to run demonstration
// demonstrateAPI();


export default async function TrafficPage() {
  const result = await checkDbConnection();


  // ###

  console.debug('🚦 Fetching Caltrans Lane Closure Data...\n');
    
  const allClosures = await fetchAllLaneClosures();

  // Count total closures
  let totalClosures = 0;
  for (const [district, data] of Object.entries(allClosures)) {
      const closures = data?.lcsClosures?.length || 0;
      totalClosures += closures;
      console.debug(`${district}: ${closures} active lane closures`);
  }

  console.debug(`\n📊 Total active lane closures across California: ${totalClosures}`);

  // Save to database
  await saveToDatabase(allClosures);


  // Fetch CCTV Camera Data
  const allCCTV =  await fetchCCTVData();
  console.debug(allCCTV);

  // Fetch CHP Collision Data (Historical)
  const allCollisions = await demonstrateAPI();
  console.debug(allCollisions);

  // ###


  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 md:max-w-lg md:px-0 lg:max-w-xl">
        <NavBar />
        <main className="flex flex-1 flex-col">
          <h2 className="text-2xl font-semibold leading-none tracking-tighter md:text-2xl md:leading-none lg:text-2xl lg:leading-none">
            MC.News Traffic Data
          </h2>
          {/* <p className="mt-3.5 max-w-lg text-base leading-snug tracking-tight text-[#61646B] md:text-lg md:leading-snug lg:text-xl lg:leading-snug dark:text-[#94979E]">
            A template for building full-stack React application using
            Next.js, Vercel, and Neon, with Postgres.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5 md:mt-9 lg:mt-10">
            <Link
              className="rounded-full bg-[#00E599] px-5 py-2.5 font-semibold tracking-tight text-[#0C0D0D] transition-colors duration-200 hover:bg-[#00E5BF] lg:px-7 lg:py-3"
              href="https://mendocinocoast.news/traffic"
              target="_blank"
            >
              View on MendocinoCoast.News
            </Link>
            <Link
              className="group flex items-center gap-2 leading-none tracking-tight"
              href="https://github.com/marty-mcgee/mcnews-nextjs-neon"
              target="_blank"
            >
              View on GitHub
              <Image
                className="transition-transform duration-200 group-hover:translate-x-1 dark:invert"
                src="/arrow.svg"
                alt="arrow"
                width={16}
                height={10}
                priority
              />
            </Link>
          </div> */}
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4E5E7] py-5 sm:gap-2 sm:gap-6 md:pb-12 md:pt-10 dark:border-[#303236]">
          <ul className="flex items-center gap-4 sm:gap-6">
            {[
              {
                text: "Neon Docs",
                href: "https://neon.tech/docs/",
                icon: "/docs.svg",
              },
              {
                text: "Neon Discord",
                href: "https://discord.com/invite/92vNTzKDGp",
                icon: "/discord.svg",
              },
            ].map((link) => (
              <Link
                className="flex items-center gap-2 opacity-70 transition-opacity duration-200 hover:opacity-100"
                key={link.text}
                href={link.href}
                target="_blank"
              >
                <Image
                  className="dark:invert"
                  src={link.icon}
                  alt={link.text}
                  width={16}
                  height={16}
                  priority
                />
                <span className="text-sm tracking-tight">{link.text}</span>
              </Link>
            ))}
          </ul>
          <span
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              result === "Database connected"
                ? "border-[#00E599]/20 bg-[#00E599]/10 text-[#1a8c66] dark:bg-[#00E599]/10 dark:text-[#00E599]"
                : "border-red-500/20 bg-red-500/10 text-red-500 dark:text-red-500"
            }`}
          >
            {result}
          </span>
        </footer>
      </div>
    </div>
  );
}
