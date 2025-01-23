'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  async function handleDelete() {
    try {
      await ticketQueries.deleteTicket(ticket.id, ticket.organization_id);
      router.push('/dashboard/tickets');
    } catch (error) {
      console.error('Error deleting ticket:', error);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <button
          onClick={() => router.push('/dashboard/tickets')}
          className="text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
        >
          ← Back to tickets
        </button>

        <div className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-semibold text-gray-900">{ticket.title}</h1>
              <div className="flex items-center space-x-4">
                <TicketMetadata
                  status={ticket.status}
                  priority={ticket.priority}
                  tag={ticket.tag}
                  showStatusControl={false}
                  showPriorityControl={false}
                />
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                >
                  Delete Ticket
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 border-b border-gray-200">
            <TicketActions
              ticket={ticket}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              onAssigneeChange={handleAssigneeChange}
            />
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
          isAdmin={true}
          onEventsUpdate={onEventsUpdate}
        />
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-sm mx-auto">
            <h3 className="text-lg font-medium mb-4">Delete Ticket</h3>
            <p className="text-gray-500 mb-4">
              Are you sure you want to delete this ticket? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 