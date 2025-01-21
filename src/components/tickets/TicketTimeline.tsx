'use client';

import { useState, useEffect } from 'react';
import { TicketEventWithUser } from '@/types/tickets';
import { supabase } from '@/utils/supabase';
import TimelineEvent from '@/components/tickets/TimelineEvent';
import { useTicketTimelineSubscription } from '@/hooks/tickets/useTicketTimelineSubscription';

interface TicketTimelineProps {
  events: TicketEventWithUser[];
  ticketId: string;
  isAdmin?: boolean;
  onEventsUpdate?: (updater: (events: TicketEventWithUser[]) => TicketEventWithUser[]) => void;
}

export default function TicketTimeline({ events: initialEvents, ticketId, isAdmin = false, onEventsUpdate }: TicketTimelineProps) {
  const [localEvents, setLocalEvents] = useState<TicketEventWithUser[]>(initialEvents);
  const filteredEvents = localEvents.filter(event => {
    // Show all events to admins
    if (isAdmin) return true;
    // For non-admins, hide tag changes and notes
    return !['tag_change', 'note'].includes(event.event_type);
  });
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Keep local events in sync with prop updates
  useEffect(() => {
    setLocalEvents(initialEvents);
  }, [initialEvents]);

  // Subscribe to real-time updates
  useTicketTimelineSubscription(ticketId, (updater) => {
    // Always update local state
    setLocalEvents(currentEvents => {
      const updatedEvents = updater(currentEvents);
      return updatedEvents;
    });
    
    // If parent provided update handler, call it too
    if (onEventsUpdate) {
      onEventsUpdate(updater);
    }
  });

  async function handleSubmit(e: React.FormEvent, type: 'comment' | 'note' = 'comment') {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('ticket_events')
        .insert([{
          ticket_id: ticketId,
          event_type: type,
          comment_text: newMessage.trim(),
          created_by: user.id,
        }]);

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error adding message:', error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Timeline</h2>
      <div className="space-y-4">
        {filteredEvents.map((event) => (
          <TimelineEvent key={event.id} event={event} />
        ))}
      </div>

      <form onSubmit={(e) => handleSubmit(e)} className="mt-6">
        <div>
          <label htmlFor="message" className="sr-only">
            Add comment or note
          </label>
          <textarea
            id="message"
            name="message"
            rows={3}
            className="shadow-sm block w-full focus:ring-blue-500 focus:border-blue-500 sm:text-sm border border-gray-300 rounded-md"
            placeholder={isAdmin ? "Add a comment or internal note..." : "Add a comment..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
        </div>
        <div className="mt-3 flex justify-end space-x-3">
          <button
            type="submit"
            disabled={submitting || !newMessage.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add Comment'}
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={(e) => handleSubmit(e, 'note')}
              disabled={submitting || !newMessage.trim()}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Internal Note'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
} 