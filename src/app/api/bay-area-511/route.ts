// src/app/api/bay-area-511/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { bayAreaTrafficEvents } from '@/lib/auth/schema';
import { desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');
  
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sqlClient = neon(connectionString);
    const db = drizzle(sqlClient);
    
    const events = await db
      .select()
      .from(bayAreaTrafficEvents)
      .orderBy(desc(bayAreaTrafficEvents.createdAt))
      .limit(limit);
    
    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}