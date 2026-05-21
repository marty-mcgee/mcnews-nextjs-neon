// src/app/api/poll/bay-area-511/route.ts
import { NextResponse } from 'next/server';
import { BayArea511Poller } from '@/lib/services/BayArea511Poller';

export const dynamic = 'force-dynamic';

const poller = new BayArea511Poller();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'poll';
  
  if (action === 'poll') {
    const result = await poller.pollAll();
    return NextResponse.json({ success: true, stats: result.stats });
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}