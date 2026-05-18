// src/app/api/poll/bay-area-511/route.ts
import { NextResponse } from 'next/server';
import { BayArea511Poller } from '@/lib/services/BayArea511Poller';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const poller = new BayArea511Poller();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'poll';
  
  try {
    switch (action) {
      case 'poll':
        return await handlePoll();
      case 'status':
        return await handleStatus();
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Bay Area 511 API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

async function handlePoll() {
  if (poller.isPollingActive()) {
    return NextResponse.json(
      { error: 'Polling already in progress', status: 'busy' },
      { status: 409 }
    );
  }
  
  const result = await poller.pollAll();
  
  return NextResponse.json({
    success: result.success,
    message: result.success ? 'Bay Area 511 poll completed' : 'Poll failed',
    stats: result.stats,
    timestamp: new Date().toISOString()
  });
}

async function handleStatus() {
  const stats = await poller.getStats();
  
  return NextResponse.json({
    success: true,
    data: stats,
    isPolling: poller.isPollingActive(),
    timestamp: new Date().toISOString()
  });
}
