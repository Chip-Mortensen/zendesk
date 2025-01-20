'use client';

import { useRouter } from 'next/navigation';
import { Ticket, TicketCommentWithUser } from '@/types/tickets';
import { ticketQueries } from '@/utils/sql/ticketQueries';
import TicketMetadata from '@/components/tickets/TicketMetadata';
import TicketComments from '@/components/tickets/TicketComments';

interface Props {
  ticket: Ticket;
  comments: TicketCommentWithUser[];
}

export default function TicketDetailContent({
  ticket,
  comments
}: Props) {
  const router = useRouter();

  async function handleStatusChange(newStatus: Ticket['status']) {
    try {
      const { error } = await ticketQueries.updateTicket(ticket.id, { status: newStatus });
      if (error) throw error;
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

      <TicketComments
        comments={comments}
        ticketId={ticket.id}
      />
    </div>
  );
} 