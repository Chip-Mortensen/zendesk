'use client';

import { useRouter } from 'next/navigation';
import { Ticket, TicketEventWithUser } from '@/types/tickets';
import TicketMetadata from '@/components/tickets/TicketMetadata';
import TicketTimeline from '@/components/tickets/TicketTimeline';
import { useTicketTimelineSubscription } from '@/hooks/tickets/useTicketTimelineSubscription';

interface Props {
  ticket: Ticket;
  events: TicketEventWithUser[];
  onEventsUpdate: (updater: (events: TicketEventWithUser[]) => TicketEventWithUser[]) => void;
}

export default function TicketDetailContent({
  ticket,
  events,
  onEventsUpdate
}: Props) {
  const router = useRouter();

  // Subscribe to timeline events
  useTicketTimelineSubscription(ticket.id, onEventsUpdate);

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
            <TicketMetadata
              status={ticket.status}
              priority={ticket.priority}
              showStatusControl={false}
              showPriorityControl={false}
              showPriorityBadge={false}
            />
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
      />
    </div>
  );
} 