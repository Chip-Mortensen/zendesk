'use client';

import { useRouter } from 'next/navigation';
import { Ticket, TicketEventWithUser } from '@/types/tickets';
import TicketMetadata from '@/components/tickets/TicketMetadata';
import TicketTimeline from '@/components/tickets/TicketTimeline';

interface Props {
  ticket: Ticket;
  events: TicketEventWithUser[];
}

export default function TicketDetailContent({
  ticket,
  events
}: Props) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">{ticket.title}</h1>
        <TicketMetadata
          createdAt={ticket.created_at}
          status={ticket.status}
          showStatusControl={false}
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