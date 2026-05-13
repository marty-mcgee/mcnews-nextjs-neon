// "use client"

import Image from "next/image";
import Link from "next/link";
import { NavBar } from "@/components/navbar";
import { checkDbConnection } from "@/lib/db/client";

// caltrans-cwwp2.js
// const axios = require('axios');
import axios from "axios";

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
// async function main() {
//     console.log('🚦 Fetching Caltrans Lane Closure Data...\n');
    
//     const allClosures = await fetchAllLaneClosures();
    
//     // Count total closures
//     let totalClosures = 0;
//     for (const [district, data] of Object.entries(allClosures)) {
//         const closures = data?.lcsClosures?.length || 0;
//         totalClosures += closures;
//         console.log(`${district}: ${closures} active lane closures`);
//     }
    
//     console.log(`\n📊 Total active lane closures across California: ${totalClosures}`);
    
//     // Save to database
//     await saveToDatabase(allClosures);
// }

// Database storage function
async function saveToDatabase(data) {
    // Implementation depends on your database
    console.log('💾 Data ready for database storage');
}

// main();


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

  // ###


  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 md:max-w-lg md:px-0 lg:max-w-xl">
        <NavBar />
        <main className="flex flex-1 flex-col justify-center">
          <h1 className="text-3xl font-semibold leading-none tracking-tighter md:text-4xl md:leading-none lg:text-5xl lg:leading-none">
            MC.News Traffic Data
          </h1>
          <p className="mt-3.5 max-w-lg text-base leading-snug tracking-tight text-[#61646B] md:text-lg md:leading-snug lg:text-xl lg:leading-snug dark:text-[#94979E]">
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
          </div>
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
