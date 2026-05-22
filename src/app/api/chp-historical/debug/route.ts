// src/app/api/debug/chp-direct/route.ts
import { NextResponse } from 'next/server';
import axios from 'axios';
import { db } from '@/lib/db/client';
import { chpCollisions } from '@/lib/auth/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: any = {};

  try {
    // Direct API call
    const response = await axios.get('https://data.ca.gov/api/3/action/datastore_search', {
      params: {
        resource_id: 'b8ce0ca4-b4e9-490d-b4d1-1f4ec48cbefb',
        limit: 5,
        offset: 0
      }
    });
    
    results.apiResponse = {
      status: response.status,
      success: response.data?.success,
      recordCount: response.data?.result?.records?.length,
      total: response.data?.result?.total,
      firstRecord: response.data?.result?.records?.[0]
    };
    
    // Try to insert one record
    if (response.data?.result?.records?.length > 0) {
      const record = response.data.result.records[0];
      const caseId = record['Report Number'];
      
      results.attemptedInsert = { caseId };
      
      // Check if exists
      const existing = await db
        .select()
        .from(chpCollisions)
        .where(eq(chpCollisions.caseId, caseId))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(chpCollisions).values({
          caseId: caseId,
          collisionDate: record['Crash Date Time'] ? new Date(record['Crash Date Time']) : null,
          severity: 'Unknown',
          county: null,
          city: record['City Name'],
          location: record['Primary Road'],
          injuries: record['NumberInjured'] || 0,
          fatalities: record['NumberKilled'] || 0,
          rawData: record,
        });
        results.insertResult = 'Successfully inserted';
      } else {
        results.insertResult = 'Already exists';
      }
    }
    
    return NextResponse.json({ success: true, results });
    
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}