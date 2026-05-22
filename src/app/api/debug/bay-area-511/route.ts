// src/app/api/debug/511/route.ts
import { NextResponse } from 'next/server';
import { BayArea511Poller } from '@/lib/services/BayArea511Poller';

export const dynamic = 'force-dynamic';

export async function GET() {
  const poller = new BayArea511Poller();
  const result = await poller.debugFetch();
  
  return NextResponse.json({
    success: !!result,
    data: result,
    timestamp: new Date().toISOString()
  });
}