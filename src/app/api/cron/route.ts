import { NextResponse } from 'next/server';
import { processNotifications } from '@/utils/notifications';

// Edge function configuration
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  console.log('🔄 Cron job started:', new Date().toISOString());
  
  // Check for the secret to prevent unauthorized access
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
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
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Cron job failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 