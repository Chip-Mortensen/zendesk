'use client';

import { useRouter } from 'next/navigation';
import { Ticket, TicketEventWithUser } from '@/types/tickets';
import TicketMetadata from '@/components/tickets/TicketMetadata';
import TicketTimeline from '@/components/tickets/TicketTimeline';
import { RatingButton } from '@/components/tickets/RatingButton';
import { ticketQueries } from '@/utils/sql/ticketQueries';
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

interface Props {
  ticket: Ticket;
  events: TicketEventWithUser[];
}

export default function TicketDetailContent({
  ticket,
  events
}: Props) {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    async function getUserId() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    }
    getUserId();
  }, []);

  const handleRatingSubmit = async (ticketId: string, rating: number, comment?: string) => {
    try {
      await ticketQueries.updateTicketRating(ticketId, rating, comment, userId);
      // Update events will happen automatically through subscription
    } catch (error) {
      console.error('Error submitting rating:', error);
    }
  };

  const toggleNotifications = async () => {
    try {
      setIsUpdating(true);
      await ticketQueries.updateTicket(ticket.id, {
        notifications_enabled: !ticket.notifications_enabled
      });
    } catch (error) {
      console.error('Error toggling notifications:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
      >
        ← Back
      </button>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">{ticket.title}</h1>
            <div className="flex items-center gap-4">
              {ticket.status === 'closed' && (
                <RatingButton
                  ticketId={ticket.id}
                  currentRating={ticket.rating}
                  currentComment={ticket.rating_comment}
                  onSubmitRating={handleRatingSubmit}
                />
              )}
              <TicketMetadata
                status={ticket.status}
                priority={ticket.priority}
                showStatusControl={false}
                showPriorityControl={false}
                showPriorityBadge={false}
              />
            </div>
          </div>
          <div className="flex items-center mt-4">
            <button
              onClick={toggleNotifications}
              disabled={isUpdating}
              className={`
                inline-flex items-center px-4 py-2 rounded-md text-sm font-medium
                ${ticket.notifications_enabled
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
                transition-colors duration-150
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 mr-2 ${ticket.notifications_enabled ? 'text-blue-700' : 'text-gray-700'}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
              {ticket.notifications_enabled ? 'Notifications On' : 'Notifications Off'}
            </button>
            <span className="ml-2 text-sm text-gray-500">
              {ticket.notifications_enabled
                ? 'You will receive email updates about this ticket'
                : 'Turn on to receive email updates'}
            </span>
          </div>
        </div>
        <div className="p-6">
          <div className="mb-2 text-sm text-gray-500">
            Created on {new Date(ticket.created_at).toLocaleDateString()}
          </div>
          <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
        </div>
      </div>

      <TicketTimeline
        events={events}
        ticketId={ticket.id}
        isAdmin={false}
        ticket={ticket}
      />
    </div>
  );
} 