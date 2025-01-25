import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NotificationQueue } from '@/types/database';

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  
  // Get pending notifications
  const { data: notifications } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('retry_count', 3) // Only process notifications that haven't failed too many times
    .order('created_at', { ascending: true })
    .limit(50); // Process in batches to avoid timeouts

  if (!notifications) return NextResponse.json({ success: true, processed: 0 });

  let successCount = 0;
  let failureCount = 0;

  // Process each notification
  for (const notification of notifications as NotificationQueue[]) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: notification.user_id,
          ticketId: notification.ticket_id,
          eventId: notification.event_id
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send notification: ${response.statusText}`);
      }

      // Update status to sent
      await supabase
        .from('notification_queue')
        .update({ status: 'sent' })
        .eq('id', notification.id);

      successCount++;
    } catch (error) {
      console.error('Error processing notification:', error);
      failureCount++;

      // Update retry count and status
      await supabase
        .from('notification_queue')
        .update({ 
          status: 'failed',
          retry_count: notification.retry_count + 1,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', notification.id);
    }
  }

  return NextResponse.json({ 
    success: true, 
    processed: notifications.length,
    successCount,
    failureCount
  });
} 