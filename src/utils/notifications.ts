import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NotificationQueue } from '@/types/database';

export async function processNotifications() {
  const supabase = createRouteHandlerClient({ cookies });
  
  console.log('📬 Fetching pending notifications...');
  
  // Get pending and failed notifications that haven't exceeded retry limit
  const { data: notifications } = await supabase
    .from('notification_queue')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lt('retry_count', 3)
    .order('created_at', { ascending: true })
    .limit(50);

  if (!notifications) {
    console.log('ℹ️ No notifications to process');
    return { success: true, processed: 0 };
  }

  console.log(`📝 Processing ${notifications.length} notifications...`);
  let successCount = 0;
  let failureCount = 0;

  // Process each notification
  for (const notification of notifications as NotificationQueue[]) {
    try {
      console.log(`🔄 Processing notification ${notification.id} for ticket ${notification.ticket_id} (Attempt ${notification.retry_count + 1})`);
      
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
        const errorText = await response.text();
        throw new Error(`Failed to send notification: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Update status to sent
      await supabase
        .from('notification_queue')
        .update({ 
          status: 'sent',
          error: null // Clear any previous error
        }) 
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