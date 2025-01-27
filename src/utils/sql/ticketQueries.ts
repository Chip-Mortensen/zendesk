import { supabase } from '../supabase';
import { Ticket, TicketEvent, TicketEventWithUser, TicketRatingEvent } from '@/types/tickets';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { suggestAndUpdateTicketTag } from '../ai/tagSuggestion';

export type TicketError = {
  message: string;
  details?: unknown;
};

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
  async createTicket(
    title: string,
    description: string,
    organizationId: string,
    createdBy: string
  ): Promise<{ data: Ticket | null; error: TicketError | null }> {
    // Create ticket without a tag first
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        title,
        description,
        organization_id: organizationId,
        created_by: createdBy,
        status: 'open',
        priority: 'medium'
      })
      .select()
      .single();

    if (error) return { data: null, error: { message: error.message, details: error } };

    // Trigger async tag suggestion
    await suggestAndUpdateTicketTag(data.id, title, description, organizationId);

    return { data, error: null };
  },

  // Update a ticket
  async updateTicket(ticketId: string, updates: Partial<Ticket>) {
    const { data, error } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return data;
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
  },

  // Update ticket priority and create a priority change event
  async updateTicketPriority(ticketId: string, newPriority: Ticket['priority'], userId: string) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('priority')
      .eq('id', ticketId)
      .single();

    if (!ticket) throw new Error('Ticket not found');

    const oldPriority = ticket.priority;

    // Call the stored procedure
    const { data, error } = await supabase.rpc('update_ticket_priority', {
      p_ticket_id: ticketId,
      p_new_priority: newPriority,
      p_old_priority: oldPriority,
      p_user_id: userId
    });

    if (error) throw error;
    
    if (data && !data.success) {
      throw new Error(data.message || 'Failed to update ticket priority');
    }
  },

  // Update ticket assignment and create an assignment change event
  async updateTicketAssignment(ticketId: string, newAssigneeId: string | null, userId: string) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('assigned_to')
      .eq('id', ticketId)
      .single();

    if (!ticket) throw new Error('Ticket not found');

    const oldAssigneeId = ticket.assigned_to;

    // Call the stored procedure
    const { data, error } = await supabase.rpc('update_ticket_assignment', {
      p_ticket_id: ticketId,
      p_new_assignee: newAssigneeId,
      p_old_assignee: oldAssigneeId,
      p_user_id: userId
    });

    if (error) throw error;
    
    if (data && !data.success) {
      throw new Error(data.message || 'Failed to update ticket assignment');
    }
  },

  // Get eligible assignees for a ticket (org members)
  async getEligibleAssignees(organizationId: string): Promise<Array<{ id: string; name: string; email: string }>> {
    const { data, error } = await supabase
      .from('org_members')
      .select(`
        users:user_id (
          id,
          name,
          email
        )
      `)
      .eq('organization_id', organizationId)
      .neq('role', 'customer');

    if (error) throw error;
    
    return (data?.map(member => member.users) ?? []).flat() as Array<{ id: string; name: string; email: string }>;
  },

  // Update ticket tag and create a tag change event
  async updateTicketTag(ticketId: string, newTag: string | null, userId: string) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('tag')
      .eq('id', ticketId)
      .single();

    if (!ticket) throw new Error('Ticket not found');

    const oldTag = ticket.tag;

    // Call the stored procedure
    const { data, error } = await supabase.rpc('update_ticket_tag', {
      p_ticket_id: ticketId,
      p_new_tag: newTag,
      p_old_tag: oldTag,
      p_user_id: userId
    });

    if (error) throw error;
    
    if (data && !data.success) {
      throw new Error(data.message || 'Failed to update ticket tag');
    }
  },

  // Get distinct tags for an organization
  async getDistinctTags(organizationId: string): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_distinct_tags', {
      p_organization_id: organizationId
    });

    if (error) throw error;
    return (data || []).map((row: { tag: string }) => row.tag);
  },

  // Bulk update ticket status
  async bulkUpdateStatus(ticketIds: string[], newStatus: Ticket['status'], userId: string) {
    const { data, error } = await supabase.rpc('bulk_update_ticket_status', {
      p_ticket_ids: ticketIds,
      p_new_status: newStatus,
      p_user_id: userId
    });

    return { data: data?.[0], error };
  },

  // Bulk update ticket priority
  async bulkUpdatePriority(ticketIds: string[], newPriority: Ticket['priority'], userId: string) {
    const { data, error } = await supabase.rpc('bulk_update_ticket_priority', {
      p_ticket_ids: ticketIds,
      p_new_priority: newPriority,
      p_user_id: userId
    });

    return { data: data?.[0], error };
  },

  // Bulk update ticket assignment
  async bulkUpdateAssignment(ticketIds: string[], newAssigneeId: string | null, userId: string) {
    const { data, error } = await supabase.rpc('bulk_update_ticket_assignment', {
      p_ticket_ids: ticketIds,
      p_new_assignee: newAssigneeId === 'unassigned' ? null : newAssigneeId,
      p_user_id: userId
    });

    return { data: data?.[0], error };
  },

  // Bulk update ticket tag
  async bulkUpdateTag(ticketIds: string[], newTag: string | null, userId: string) {
    const { data, error } = await supabase.rpc('bulk_update_ticket_tag', {
      p_ticket_ids: ticketIds,
      p_new_tag: newTag === '' ? null : newTag,
      p_user_id: userId
    });

    return { data: data?.[0], error };
  },

  // Update ticket rating and create a rating event
  async updateTicketRating(ticketId: string, rating: number, comment: string | undefined, userId: string) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('rating')
      .eq('id', ticketId)
      .single();

    if (!ticket) throw new Error('Ticket not found');

    // Update the ticket rating
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        rating,
        rating_comment: comment,
        rating_submitted_at: new Date().toISOString(),
      })
      .eq('id', ticketId);

    if (updateError) throw updateError;

    // Create a rating event
    const event: Omit<TicketRatingEvent, 'id' | 'created_at'> = {
      ticket_id: ticketId,
      event_type: 'rating',
      created_by: userId,
      rating_value: rating,
      rating_comment: comment
    };

    const { error: eventError } = await supabase
      .from('ticket_events')
      .insert([event]);

    if (eventError) throw eventError;

    return { success: true };
  },

  async toggleAI(ticketId: string, enabled: boolean) {
    const { data, error } = await supabase
      .from('tickets')
      .update({ ai_enabled: enabled })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return data;
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
        users!inner (
          id,
          name,
          email
        )
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching events:', error);
    } else if (data) {
      console.log('Events data structure:', data[0]);
    }
    return {
      data: data as TicketEventWithUser[] | null,
      error
    };
  },

  // Create a new event
  async createEvent(event: Omit<TicketEvent, 'id' | 'created_at'>) {
    
    const result = await supabase
      .from('ticket_events')
      .insert([event])
      .select(`
        *,
        users!inner (
          id,
          name,
          email
        )
      `)
      .single();

    if (result.error) {
      console.error('Error creating event:', result.error);
    } else if (result.data) {
      console.log('Created event data:', result.data);
    }
    return result;
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
        (payload: RealtimePostgresChangesPayload<Ticket>) => {
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('Ticket subscription status:', status);
      });
  },

  // Subscribe to ticket events
  subscribeToEvents(ticketId: string, callback: (payload: RealtimePostgresChangesPayload<TicketEventWithUser>) => void) {
    console.log('Setting up events subscription for:', ticketId);
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
            const { data, error } = await supabase
              .from('ticket_events')
              .select(`
                *,
                users!inner (
                  id,
                  name,
                  email
                )
              `)
              .eq('id', payload.new.id)
              .single();
            
            if (error) {
              console.error('Error fetching event data:', error);
              return;
            }
            
            if (data) {
              console.log('Successfully fetched event data:', data);
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
      .subscribe((status) => {
        console.log('Events subscription status:', status);
      });
  }
}; 