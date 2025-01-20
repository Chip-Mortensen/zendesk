'use client';

import { useState } from 'react';
import { TicketEventWithUser } from '@/types/tickets';
import { supabase } from '@/utils/supabase';
import TimelineEvent from '@/components/tickets/TimelineEvent';
import { useTicketTimelineSubscription } from '@/hooks/tickets/useTicketTimelineSubscription';

interface TicketTimelineProps {
  events: TicketEventWithUser[];
  ticketId: string;
}

export default function TicketTimeline({ events: initialEvents, ticketId }: TicketTimelineProps) {
  const [events, setEvents] = useState<TicketEventWithUser[]>(initialEvents);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Subscribe to real-time updates
  useTicketTimelineSubscription(ticketId, setEvents);

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('ticket_events')
        .insert([{
          ticket_id: ticketId,
          event_type: 'comment',
          comment_text: newComment.trim(),
          created_by: user.id,
        }]);

      if (error) throw error;
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Timeline</h2>
      <div className="space-y-4">
        {events.map((event) => (
          <TimelineEvent key={event.id} event={event} />
        ))}
      </div>

      <form onSubmit={handleAddComment} className="mt-6">
        <div>
          <label htmlFor="comment" className="sr-only">
            Add comment
          </label>
          <textarea
            id="comment"
            name="comment"
            rows={3}
            className="shadow-sm block w-full focus:ring-blue-500 focus:border-blue-500 sm:text-sm border border-gray-300 rounded-md"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
        </div>
        <div className="mt-3">
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add Comment'}
          </button>
        </div>
      </form>
    </div>
  );
} 