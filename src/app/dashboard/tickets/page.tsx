'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import PriorityBadge from '@/components/tickets/PriorityBadge';
import TagBadge from '@/components/tickets/TagBadge';
import SortableHeader from '@/components/table/SortableHeader';
import { sortTickets } from '@/utils/sorting';
import TicketFilters, { TicketFilters as TicketFiltersType } from '@/components/tickets/TicketFilters';
import { isToday, isThisWeek } from 'date-fns';
import { Ticket } from '@/types/tickets';
import { userQueries } from '@/utils/sql/userQueries';
import { UserSettings } from '@/types/settings';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import BulkActionsBar from '@/components/tickets/BulkActionsBar';

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings>({});
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc'
  });
  const [filters, setFilters] = useState<TicketFiltersType>({
    status: [],
    priority: [],
    assignee: [],
    customer: [],
    tag: [],
    created: []
  });

  // Add selected tickets state
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadUserAndTickets() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error('No session found');
          router.push('/auth?type=admin');
          return;
        }

        console.log('Current user ID:', session.user.id);
        setUserId(session.user.id);

        // Load user settings
        try {
          const settings = await userQueries.getUserSettings(session.user.id);
          if (settings?.ticket_filters) {
            setFilters(settings.ticket_filters);
            setUserSettings(settings);
          }
        } catch (error) {
          console.error('Error loading user settings:', error);
        }

        // Get user's organization
        const { data: memberData, error: memberError } = await supabase
          .from('org_members')
          .select('organization_id')
          .eq('user_id', session.user.id)
          .in('role', ['admin', 'employee'])
          .single();

        if (memberError || !memberData) {
          console.error('Error fetching member data:', memberError);
          router.push('/auth?type=admin');
          return;
        }

        setOrganizationId(memberData.organization_id);

        // Get tickets for this organization
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('tickets')
          .select(`
            *,
            assignee:users!tickets_assigned_to_fkey (
              name
            ),
            customer:users!tickets_created_by_fkey (
              name
            )
          `)
          .eq('organization_id', memberData.organization_id)
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
  }, [router]);

  // Subscribe to user settings changes
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`user-settings-${userId}`);
    
    const subscription = channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        async (payload) => {
          if (payload.eventType === 'UPDATE') {
            const newSettings = (payload.new as { settings: UserSettings }).settings || {
              ticket_filters: {
                status: [],
                priority: [],
                assignee: [],
                customer: [],
                tag: [],
                created: []
              }
            };
            setUserSettings(newSettings);
            if (newSettings.ticket_filters) {
              setFilters(newSettings.ticket_filters);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  // Separate effect for tickets realtime subscription
  useEffect(() => {
    if (!organizationId) return;

    const channelName = `admin-tickets-${organizationId}`;
    const channel = supabase.channel(channelName);
    
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        async (payload: RealtimePostgresChangesPayload<{
          id: string;
          [key: string]: unknown;
        }>) => {
          if (payload.eventType === 'DELETE') {
            setTickets(currentTickets => 
              currentTickets.filter(ticket => ticket.id !== payload.old.id)
            );
          } else {
            // Reload all tickets to ensure we have the latest data with all relations
            const { data: ticketsData, error: ticketsError } = await supabase
              .from('tickets')
              .select(`
                *,
                assignee:users!tickets_assigned_to_fkey (
                  name
                ),
                customer:users!tickets_created_by_fkey (
                  name
                )
              `)
              .eq('organization_id', organizationId)
              .order('created_at', { ascending: false });

            if (!ticketsError && ticketsData) {
              setTickets(ticketsData);
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [organizationId]);

  const handleSort = (field: string) => {
    setSortConfig(current => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFiltersChange = async (newFilters: TicketFiltersType) => {
    if (!userId) {
      console.error('No user ID available when trying to save filters');
      return;
    }
    
    setFilters(newFilters);
    
    try {
      // Merge with existing settings
      const newSettings: UserSettings = {
        ...userSettings,
        ticket_filters: newFilters
      };
      
      await userQueries.updateUserSettings(userId, newSettings);
      setUserSettings(newSettings);
    } catch (error) {
      console.error('Error saving filters:', error);
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      const matchesStatus = filters.status.length === 0 || filters.status.includes(ticket.status);
      const matchesPriority = filters.priority.length === 0 || filters.priority.includes(ticket.priority);
      const matchesAssignee = filters.assignee.length === 0 || filters.assignee.includes(ticket.assignee?.name || '');
      const matchesCustomer = filters.customer.length === 0 || filters.customer.includes(ticket.customer?.name || '');
      const matchesTag = filters.tag.length === 0 || filters.tag.includes(ticket.tag || '');
      const matchesCreated = filters.created.length === 0 || filters.created.some(dateFilter => {
        if (dateFilter === 'today') return isToday(new Date(ticket.created_at));
        if (dateFilter === 'this_week') return isThisWeek(new Date(ticket.created_at));
        return true;
      });

      return matchesStatus && matchesPriority && matchesAssignee && matchesCustomer && matchesTag && matchesCreated;
    });
  }, [tickets, filters]);

  const sortedTickets = useMemo(() => {
    return sortTickets(filteredTickets, sortConfig.field, sortConfig.direction);
  }, [filteredTickets, sortConfig]);

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

  // Toggle single ticket selection
  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTickets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  };

  // Toggle all tickets selection
  const toggleSelectAll = () => {
    if (selectedTickets.size === sortedTickets.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(sortedTickets.map(t => t.id)));
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTickets(new Set());
  };

  if (loading) {
    return <div className="text-center py-12">Loading tickets...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold">Support Tickets</h1>
            <p className="mt-1 text-sm text-gray-500">
              View and manage all customer support tickets.
            </p>
          </div>
        </div>

        <div className="border-b border-gray-200">
          <TicketFilters
            tickets={tickets}
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />
          {selectedTickets.size > 0 && (
            <BulkActionsBar
              selectedTickets={Array.from(selectedTickets)}
              onClearSelection={clearSelection}
            />
          )}
        </div>

        <div className="max-h-[calc(100vh-24rem)] overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th scope="col" className="relative px-6 py-3">
                  <input
                    type="checkbox"
                    className="absolute left-4 top-1/2 -mt-3 h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedTickets.size === sortedTickets.length && sortedTickets.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
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
                  label="Assignee"
                  field="assigned_to"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Customer"
                  field="created_by"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Tag"
                  field="tag"
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
                  className="group transition-colors duration-150 hover:bg-gray-50"
                >
                  <td className="relative px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="absolute left-4 top-1/2 -mt-3 h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedTickets.has(ticket.id)}
                      onChange={() => toggleTicketSelection(ticket.id)}
                    />
                  </td>
                  <td 
                    className="px-6 py-4 cursor-pointer"
                    onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
                  >
                    <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600">{ticket.title}</div>
                    <div className="text-sm text-gray-500">{ticket.description.substring(0, 100)}...</div>
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap cursor-pointer"
                    onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
                  >
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap cursor-pointer"
                    onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
                  >
                    <PriorityBadge priority={ticket.priority} />
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
                  >
                    {ticket.assignee?.name || (
                      <span className="text-yellow-600">Unassigned</span>
                    )}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
                  >
                    {ticket.customer?.name}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap cursor-pointer"
                    onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
                  >
                    <TagBadge tag={ticket.tag} />
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
                  >
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 