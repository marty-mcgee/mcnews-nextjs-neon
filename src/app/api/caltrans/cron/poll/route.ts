// app/api/caltrans/cron/poll/route.ts
import { NextResponse } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key';

export async function GET(request: Request) {
  // Verify cron job authorization
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Call the poll endpoint internally
    const pollUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/caltrans/poll?action=poll`;
    const response = await fetch(pollUrl);
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      message: 'Cron polling completed',
      result: data
    });
    
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json(
      { error: 'Cron polling failed' },
      { status: 500 }
    );
  }
}
