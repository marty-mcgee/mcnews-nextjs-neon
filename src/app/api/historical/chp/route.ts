// app/api/historical/chp/route.ts
import { NextResponse } from 'next/server';
import { CHPPoller } from '@/lib/services/CHPPoller';

export const maxDuration = 300; // 5 minutes for large historical data
export const dynamic = 'force-dynamic';

const chpPoller = new CHPPoller();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'poll';
  const county = searchParams.get('county') || undefined;
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
  
  try {
    switch (action) {
      case 'poll':
        return await handlePoll({ county, year, limit });
      case 'status':
        return await handleStatus();
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('CHP API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

async function handlePoll(options: { county?: string; year?: number; limit?: number }) {
  if (chpPoller.isPollingActive()) {
    return NextResponse.json(
      { error: 'Polling already in progress', status: 'busy' },
      { status: 409 }
    );
  }
  
  const result = await chpPoller.pollAll(options);
  
  return NextResponse.json({
    success: result.success,
    message: result.success ? 'CHP data poll completed' : 'Poll failed',
    stats: result.stats,
    timestamp: new Date().toISOString()
  });
}

async function handleStatus() {
  const stats = await chpPoller.getStats();
  
  return NextResponse.json({
    success: true,
    data: stats,
    isPolling: chpPoller.isPollingActive(),
    timestamp: new Date().toISOString()
  });
}