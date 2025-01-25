import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NotificationQueue } from '@/types/database';

export async function processNotifications() {
  const supabase = createRouteHandlerClient({ cookies });
  
  console.log('📬 Fetching pending notifications...');
  
  // Get pending notifications
  const { data: notifications } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('retry_count', 3)
    .order('created_at', { ascending: true })
    .limit(50);

  if (!notifications) {
    console.log('ℹ️ No pending notifications found');
    return { success: true, processed: 0 };
  }

  console.log(`📝 Processing ${notifications.length} notifications...`);
  let successCount = 0;
  let failureCount = 0;

  // Process each notification
  for (const notification of notifications as NotificationQueue[]) {
    try {
      console.log(`🔄 Processing notification ${notification.id} for ticket ${notification.ticket_id}`);
      
      const response = await fetch(`${process.env.DEPLOYED_URL}/api/send-notification`, {
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

      console.log(`✅ Successfully processed notification ${notification.id}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error processing notification ${notification.id}:`, error);
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

  console.log('📊 Processing summary:', {
    total: notifications.length,
    successful: successCount,
    failed: failureCount
  });

  return { 
    success: true, 
    processed: notifications.length,
    successCount,
    failureCount
  };
} 