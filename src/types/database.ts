export interface NotificationQueue {
  id: string;
  created_at: string;
  user_id: string;
  ticket_id: string;
  event_id: string;
  status: 'pending' | 'sent' | 'failed';
  retry_count: number;
  error?: string;
} 