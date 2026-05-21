// src/app/api/historical/chp/route.ts
import { NextResponse } from 'next/server';
import { CHPPoller } from '@/lib/services/CHPPoller-1';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const chpPoller = new CHPPoller();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'poll';
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;
  
  try {
    switch (action) {
      case 'poll':
        const result = await chpPoller.pollAll({ limit });
        return NextResponse.json({
          success: result.success,
          message: result.success ? 'CHP data poll completed' : 'Poll failed',
          stats: result.stats,
          timestamp: new Date().toISOString()
        });
      case 'status':
        const stats = await chpPoller.getStats();
        return NextResponse.json({
          success: true,
          data: stats,
          isPolling: chpPoller.isPollingActive(),
          timestamp: new Date().toISOString()
        });
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('CHP Historical API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}