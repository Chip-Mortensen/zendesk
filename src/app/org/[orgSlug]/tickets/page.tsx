'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import CreateTicketModal from '@/components/tickets/CreateTicketModal';
import PriorityBadge from '@/components/tickets/PriorityBadge';
import SortableHeader from '@/components/table/SortableHeader';
import { sortTickets, SortableTicket } from '@/utils/sorting';

type Ticket = Omit<SortableTicket, 'tag'>;

export default function CustomerTicketsPage() {
  const params = useParams();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgSlug, setOrgSlug] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc'
  });

  // Set orgSlug once when component mounts
  useEffect(() => {
    const slug = params?.orgSlug;
    if (typeof slug === 'string') {
      setOrgSlug(slug);
    }
  }, [params?.orgSlug]);

  useEffect(() => {
    if (!orgSlug) return;

    async function loadUserAndTickets() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error('No session found');
          router.push('/login');
          return;
        }

        // First get the organization ID from the slug
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id')
          .eq('slug', orgSlug)
          .single();

        if (orgError || !orgData) {
          console.error('Organization not found:', orgError);
          return;
        }

        setOrganizationId(orgData.id);

        // Then get tickets for this organization
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('tickets')
          .select('*')
          .eq('organization_id', orgData.id)
          .order('created_at', { ascending: false });

        if (ticketsError) {
          console.error('Error fetching tickets:', ticketsError);
          return;
        }

        setTickets(ticketsData || []);
      } catch (error) {
        console.error('Error in loadUserAndTickets:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUserAndTickets();
  }, [orgSlug, router]);

  // Separate effect for realtime subscription
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase.channel(`org-tickets-${organizationId}`);
    
    const subscription = channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          console.log('Realtime update:', payload);
          if (payload.eventType === 'INSERT') {
            setTickets(currentTickets => [payload.new as Ticket, ...currentTickets]);
          } else if (payload.eventType === 'DELETE') {
            setTickets(currentTickets => 
              currentTickets.filter(ticket => ticket.id !== payload.old.id)
            );
          } else if (payload.eventType === 'UPDATE') {
            setTickets(currentTickets =>
              currentTickets.map(ticket =>
                ticket.id === payload.new.id ? { ...ticket, ...payload.new } : ticket
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [organizationId]);

  const handleSort = (field: string) => {
    setSortConfig(current => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedTickets = useMemo(() => {
    return sortTickets(tickets, sortConfig.field, sortConfig.direction);
  }, [tickets, sortConfig]);

  const getStatusColor = (status: Ticket['status']) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'closed':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading tickets...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">My Tickets</h1>
              <p className="mt-1 text-sm text-gray-500">
                Track and manage your support tickets.
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Create Ticket
            </button>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="p-6 text-gray-500">
            No tickets found. Create your first ticket to get started.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader
                  label="Title"
                  field="title"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Status"
                  field="status"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Priority"
                  field="priority"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Created"
                  field="created_at"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedTickets.map((ticket) => (
                <tr 
                  key={ticket.id} 
                  className="transition-colors duration-150 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/org/${orgSlug}/tickets/${ticket.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600">{ticket.title}</div>
                    <div className="text-sm text-gray-500">{ticket.description.substring(0, 100)}...</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <PriorityBadge priority={ticket.priority} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {organizationId && (
        <CreateTicketModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onTicketCreated={() => setIsCreateModalOpen(false)}
          organizationId={organizationId}
        />
      )}
    </div>
  );
} 