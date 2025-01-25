import { NextResponse } from 'next/server';
import { processNotifications } from '@/utils/notifications';

// Handle GET requests for manual triggers
export async function GET() {
  console.log('🔄 Process notifications route called');
  try {
    console.log('📬 Starting notification processing...');
    const result = await processNotifications();
    console.log('✅ Notification processing completed:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Error in process notifications route:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process notifications'
      },
      { status: 500 }
    );
  }
} 