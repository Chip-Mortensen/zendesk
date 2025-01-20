import { supabase } from '../supabase';
import { Ticket, TicketComment, TicketCommentWithUser } from '@/types/tickets';
import { SupabaseClient, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

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
  }
};

// Comment Queries
export const commentQueries = {
  // Fetch comments for a ticket
  async getTicketComments(ticketId: string) {
    const response = await supabase
      .from('ticket_comments')
      .select(`
        id,
        ticket_id,
        comment_text,
        created_at,
        created_by,
        users:created_by (
          name,
          email
        )
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    return {
      data: response.data as TicketCommentWithUser[] | null,
      error: response.error
    };
  },

  // Create a new comment
  async createComment(comment: Omit<TicketComment, 'id' | 'created_at'>) {
    return await supabase
      .from('ticket_comments')
      .insert([comment])
      .select()
      .single();
  },

  // Update a comment
  async updateComment(commentId: string, updates: Partial<TicketComment>) {
    return await supabase
      .from('ticket_comments')
      .update(updates)
      .eq('id', commentId)
      .select()
      .single();
  },

  // Delete a comment
  async deleteComment(commentId: string) {
    return await supabase
      .from('ticket_comments')
      .delete()
      .eq('id', commentId);
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

  // Subscribe to ticket comments
  subscribeToComments(ticketId: string, callback: (payload: RealtimePostgresChangesPayload<TicketComment>) => void) {
    return supabase
      .channel(`comments-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_comments',
          filter: `ticket_id=eq.${ticketId}`
        },
        callback
      )
      .subscribe();
  }
};

export const getTicketComments = async (supabase: SupabaseClient, ticketId: string): Promise<TicketCommentWithUser[]> => {
  try {
    const { data, error } = await supabase
      .from('ticket_comments')
      .select(`
        *,
        users (
          name,
          email
        )
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error: unknown) {
    console.error('Error fetching ticket comments:', error);
    throw error;
  }
};

export const createTicketComment = async (
  supabase: SupabaseClient, 
  ticketId: string, 
  content: string
): Promise<TicketComment> => {
  try {
    const { data, error } = await supabase
      .from('ticket_comments')
      .insert([
        {
          ticket_id: ticketId,
          content: content,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No data returned from comment creation');
    return data;
  } catch (error: unknown) {
    console.error('Error creating ticket comment:', error);
    throw error;
  }
}; 