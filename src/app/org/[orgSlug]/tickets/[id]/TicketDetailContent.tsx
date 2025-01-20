'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket } from '@/types/tickets';
import { useTicketSubscription } from '@/hooks/tickets/useTicketSubscription';
import { useCommentsSubscription } from '@/hooks/tickets/useCommentsSubscription';
import TicketMetadata from '@/components/tickets/TicketMetadata';
import TicketComments from '@/components/tickets/TicketComments';

interface Comment {
  id: string;
  ticket_id: string;
  comment_text: string;
  created_at: string;
  created_by: string;
}

interface Props {
  initialTicket: Ticket;
  initialComments: Comment[];
  organizationId: string;
  orgSlug: string;
}

export default function CustomerTicketDetailContent({
  initialTicket,
  initialComments,
  organizationId,
  orgSlug
}: Props) {
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket>(initialTicket);
  const [comments, setComments] = useState(initialComments);

  useTicketSubscription(
    ticket.id,
    (updatedTicket) => setTicket(updatedTicket),
    () => router.push(`/org/${orgSlug}/tickets`)
  );

  useCommentsSubscription(ticket.id, setComments);

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.push(`/org/${orgSlug}/tickets`)}
          className="text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
        >
          ← Back to tickets
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">{ticket.title}</h1>
        <TicketMetadata
          createdAt={ticket.created_at}
          status={ticket.status}
        />
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
      </div>

      <TicketComments
        comments={comments}
        ticketId={ticket.id}
        organizationId={organizationId}
      />
    </div>
  );
} 