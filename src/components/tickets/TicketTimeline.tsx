'use client';

import { useState, useEffect, useRef } from 'react';
import { TicketEventWithUser, Ticket } from '@/types/tickets';
import { supabase } from '@/utils/supabase';
import TimelineEvent from '@/components/tickets/TimelineEvent';
import { RatingButton } from '@/components/tickets/RatingButton';
import { ticketQueries } from '@/utils/sql/ticketQueries';

interface TicketTimelineProps {
  events: TicketEventWithUser[];
  ticketId: string;
  isAdmin?: boolean;
  onEventsUpdate?: (updater: (events: TicketEventWithUser[]) => TicketEventWithUser[]) => void;
  ticket: Ticket;
}

export default function TicketTimeline({ 
  events,
  ticketId, 
  isAdmin = false, 
  onEventsUpdate,
  ticket
}: TicketTimelineProps) {
  const timelineEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    async function getUserData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        
        // Get user's role
        const { data: memberData } = await supabase
          .from('org_members')
          .select('role')
          .eq('user_id', session.user.id)
          .single();
        
        if (memberData) {
          setUserRole(memberData.role);
        }
      }
    }
    getUserData();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  // Filter events for rendering
  const visibleEvents = events.filter(event => {
    if (isAdmin || userRole === 'employee') return true;
    return !['tag_change', 'note', 'priority_change'].includes(event.event_type);
  });

  const handleRatingSubmit = async (ticketId: string, rating: number, comment?: string) => {
    try {
      await ticketQueries.updateTicketRating(ticketId, rating, comment, userId);
      // Events will update automatically through subscription
    } catch (error) {
      console.error('Error submitting rating:', error);
    }
  };

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
      alert('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="h-[400px] overflow-y-auto p-6 space-y-4">
        <div className="flow-root">
          <ul role="list" className="space-y-4">
            {visibleEvents.map((event) => (
              <TimelineEvent key={event.id} event={event} />
            ))}
          </ul>
        </div>
        <div ref={timelineEndRef} />
      </div>

      {ticket?.status === 'closed' && !isAdmin && !ticket.rating && (
        <div className="border-t border-gray-200 p-4 bg-yellow-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">How was your experience with this ticket?</span>
            <RatingButton
              ticketId={ticketId}
              currentRating={ticket.rating}
              currentComment={ticket.rating_comment}
              onSubmitRating={handleRatingSubmit}
            />
          </div>
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e)} className="border-t border-gray-200 p-4">
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