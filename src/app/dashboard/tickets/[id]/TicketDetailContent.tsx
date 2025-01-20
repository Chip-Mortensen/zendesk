'use client';

import { useRouter } from 'next/navigation';
import { Ticket, TicketEventWithUser } from '@/types/tickets';
import { ticketQueries } from '@/utils/sql/ticketQueries';
import TicketMetadata from '@/components/tickets/TicketMetadata';
import TicketTimeline from '@/components/tickets/TicketTimeline';
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

  async function handleStatusChange(newStatus: Ticket['status']) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      await ticketQueries.updateTicketStatus(ticket.id, newStatus, user.id);
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.push('/dashboard/tickets')}
          className="text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
        >
          ← Back to tickets
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">{ticket.title}</h1>
        <TicketMetadata
          createdAt={ticket.created_at}
          status={ticket.status}
          showStatusControl
          onStatusChange={handleStatusChange}
        />
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
      </div>

      <TicketTimeline
        events={events}
        ticketId={ticket.id}
      />
    </div>
  );
} 