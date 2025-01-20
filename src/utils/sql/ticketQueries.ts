import { supabase } from '../supabase';
import { Ticket, TicketEvent, TicketEventWithUser } from '@/types/tickets';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Ticket Queries
export const ticketQueries = {
  // Fetch a single ticket by ID with org verification
  async getTicketById(ticketId: string, organizationId?: string) {
    const query = supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId);
    
    if (organizationId) {
      query.eq('organization_id', organizationId);
    }

    return await query.single();
  },

  // Fetch all tickets for an organization
  async getOrgTickets(organizationId: string) {
    return await supabase
      .from('tickets')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
  },

  // Fetch all tickets (admin view)
  async getAllTickets() {
    return await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });
  },

  // Create a new ticket
  async createTicket(ticket: Omit<Ticket, 'id' | 'created_at'>) {
    return await supabase
      .from('tickets')
      .insert([ticket])
      .select()
      .single();
  },

  // Update a ticket
  async updateTicket(ticketId: string, updates: Partial<Ticket>, organizationId?: string) {
    const query = supabase
      .from('tickets')
      .update(updates)
      .eq('id', ticketId);
    
    if (organizationId) {
      query.eq('organization_id', organizationId);
    }

    return await query.select().single();
  },

  // Delete a ticket
  async deleteTicket(ticketId: string, organizationId?: string) {
    const query = supabase
      .from('tickets')
      .delete()
      .eq('id', ticketId);
    
    if (organizationId) {
      query.eq('organization_id', organizationId);
    }

    return await query;
  },

  // Update ticket status and create a status change event
  async updateTicketStatus(ticketId: string, newStatus: Ticket['status'], userId: string) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('status')
      .eq('id', ticketId)
      .single();

    if (!ticket) throw new Error('Ticket not found');

    const oldStatus = ticket.status;

    // Call the stored procedure
    const { data, error } = await supabase.rpc('update_ticket_status', {
      p_ticket_id: ticketId,
      p_new_status: newStatus,
      p_old_status: oldStatus,
      p_user_id: userId
    });

    if (error) throw error;
    
    if (data && !data.success) {
      throw new Error(data.message || 'Failed to update ticket status');
    }
  }
};

// Event Queries
export const eventQueries = {
  // Fetch all events for a ticket
  async getTicketEvents(ticketId: string) {
    const { data, error } = await supabase
      .from('ticket_events')
      .select(`
        *,
        users!created_by (
          name,
          email
        )
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    return {
      data: data as TicketEventWithUser[] | null,
      error
    };
  },

  // Create a new event
  async createEvent(event: Omit<TicketEvent, 'id' | 'created_at'>) {
    return await supabase
      .from('ticket_events')
      .insert([event])
      .select(`
        *,
        users!created_by (
          name,
          email
        )
      `)
      .single();
  }
};

// Subscription Helpers
export const subscriptionHelpers = {
  // Subscribe to ticket changes
  subscribeToTicket(ticketId: string, callback: (payload: RealtimePostgresChangesPayload<Ticket>) => void) {
    return supabase
      .channel(`ticket-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${ticketId}`
        },
        callback
      )
      .subscribe();
  },

  // Subscribe to ticket events
  subscribeToEvents(ticketId: string, callback: (payload: RealtimePostgresChangesPayload<TicketEventWithUser>) => void) {
    return supabase
      .channel(`events-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_events',
          filter: `ticket_id=eq.${ticketId}`,
        },
        async (payload) => {
          // For INSERT and UPDATE events, fetch the full event data with user info
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { data } = await supabase
              .from('ticket_events')
              .select(`
                *,
                users!created_by (
                  name,
                  email
                )
              `)
              .eq('id', payload.new.id)
              .single();
            
            if (data) {
              callback({
                ...payload,
                new: data
              } as RealtimePostgresChangesPayload<TicketEventWithUser>);
              return;
            }
          }
          
          // For DELETE events, just pass through the payload
          callback(payload as RealtimePostgresChangesPayload<TicketEventWithUser>);
        }
      )
      .subscribe();
  }
}; 