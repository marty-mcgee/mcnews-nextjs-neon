// src/app/api/poll/route.ts
import { NextResponse } from 'next/server';
import { CaltransPoller } from '@/lib/services/CaltransPoller';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const poller = new CaltransPoller();
let isPolling = false;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'poll';
  
  try {
    if (action === 'poll') {
      if (isPolling) {
        return NextResponse.json({ error: 'Polling already in progress' }, { status: 409 });
      }
      isPolling = true;
      const result = await poller.pollAllDistricts();
      isPolling = false;
      return NextResponse.json({ success: true, stats: result.stats });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    isPolling = false;
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}