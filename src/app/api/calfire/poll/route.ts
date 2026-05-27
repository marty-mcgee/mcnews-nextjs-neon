// src/app/api/calfire/poll/route.ts
import { NextResponse } from 'next/server';
import { CalFirePoller } from '@/lib/services/CalFirePoller';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'poll';
  
  const poller = new CalFirePoller();
  
  try {
    switch (action) {
      case 'poll':
        console.log(`Starting CalFire poll...`);
        const result = await poller.pollActive();
        return NextResponse.json({
          success: result.success,
          message: result.success ? 'CalFire poll completed' : 'Poll failed',
          stats: result.stats,
          timestamp: new Date().toISOString()
        });
        
      case 'poll-all':
        console.log(`Starting CalFire full poll (including inactive)...`);
        const fullResult = await poller.pollAll({ includeInactive: true });
        return NextResponse.json({
          success: fullResult.success,
          message: fullResult.success ? 'CalFire full poll completed' : 'Poll failed',
          stats: fullResult.stats,
          timestamp: new Date().toISOString()
        });
        
      case 'stats':
        const stats = await poller.getStats();
        return NextResponse.json({
          success: true,
          data: stats,
          isPolling: poller.isPollingActive(),
          timestamp: new Date().toISOString()
        });
        
      default:
        return NextResponse.json({ error: 'Invalid action. Use "poll", "poll-all", or "stats"' }, { status: 400 });
    }
  } catch (error) {
    console.error('CalFire API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}