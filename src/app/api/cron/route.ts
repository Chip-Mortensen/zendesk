import { NextResponse } from 'next/server';
import { processNotifications } from '@/utils/notifications';

export async function GET(request: Request) {
  console.log('🔄 Cron job started:', new Date().toISOString());

  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('❌ Unauthorized cron job attempt');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await processNotifications();
    
    console.log('✅ Cron job completed:', {
      timestamp: new Date().toISOString(),
      processed: result.processed,
      successful: result.successCount,
      failed: result.failureCount
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('❌ Cron job failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Ensure this route can be dynamically invoked
export const dynamic = 'force-dynamic';