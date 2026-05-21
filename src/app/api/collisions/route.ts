// src/app/api/collisions/route.ts
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { chpCollisions } from '@/lib/auth/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');
  
  try {
    const connectionString = process.env.DATABASE_URL!;
    const sqlClient = neon(connectionString);
    const db = drizzle(sqlClient);
    
    const collisions = await db
      .select()
      .from(chpCollisions)
      .orderBy(desc(chpCollisions.collisionDate))
      .limit(limit);
    
    return NextResponse.json({
      success: true,
      data: collisions,
      count: collisions.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Collisions query error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collisions', details: String(error) },
      { status: 500 }
    );
  }
}