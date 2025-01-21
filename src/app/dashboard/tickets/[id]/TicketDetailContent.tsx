'use client';

import { useRouter } from 'next/navigation';
import { Ticket, TicketEventWithUser } from '@/types/tickets';
import { ticketQueries } from '@/utils/sql/ticketQueries';
import TicketMetadata from '@/components/tickets/TicketMetadata';
import TicketTimeline from '@/components/tickets/TicketTimeline';
import TicketActions from '@/components/tickets/TicketActions';
import { supabase } from '@/utils/supabase';

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

  async function handleStatusChange(newStatus: Ticket['status']) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      await ticketQueries.updateTicketStatus(ticket.id, newStatus, user.id);
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  }

  async function handlePriorityChange(newPriority: Ticket['priority']) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      await ticketQueries.updateTicketPriority(ticket.id, newPriority, user.id);
    } catch (error) {
      console.error('Error updating ticket priority:', error);
    }
  }

  async function handleAssigneeChange(newAssigneeId: string | null) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      await ticketQueries.updateTicketAssignment(ticket.id, newAssigneeId, user.id);
    } catch (error) {
      console.error('Error updating ticket assignment:', error);
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
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">{ticket.title}</h1>
        <TicketMetadata
          createdAt={ticket.created_at}
          status={ticket.status}
          priority={ticket.priority}
          tag={ticket.tag}
          showStatusControl={false}
          showPriorityControl={false}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
          </div>

          <TicketTimeline
            events={events}
            ticketId={ticket.id}
            isAdmin={true}
            onEventsUpdate={onEventsUpdate}
          />
        </div>

        <div className="col-span-1">
          <TicketActions
            ticket={ticket}
            onStatusChange={handleStatusChange}
            onPriorityChange={handlePriorityChange}
            onAssigneeChange={handleAssigneeChange}
          />
        </div>
      </div>
    </div>
  );
} 