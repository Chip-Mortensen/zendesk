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