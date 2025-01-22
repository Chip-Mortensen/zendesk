import { supabase } from '../supabase';
import { Conversation, ChatEvent, ChatEventWithUser } from '@/types/chat';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Conversation Queries
export const chatQueries = {
  // Fetch a single conversation by ID with org verification
  async getConversationById(conversationId: string, organizationId?: string) {
    const query = supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId);
    
    if (organizationId) {
      query.eq('organization_id', organizationId);
    }

    return await query.single();
  },

  // Fetch all conversations for an organization
  async getOrgConversations(organizationId: string) {
    return await supabase
      .from('conversations')
      .select(`
        *,
        assignee:users!conversations_assigned_to_fkey (
          name
        )
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
  },

  // Fetch conversations for a specific user
  async getUserConversations(userId: string, organizationId: string) {
    return await supabase
      .from('conversations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('created_by', userId)
      .order('created_at', { ascending: false });
  },

  // Create a new conversation
  async createConversation(conversation: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>) {
    return await supabase
      .from('conversations')
      .insert([conversation])
      .select()
      .single();
  },

  // Update conversation status and create a status change event
  async updateConversationStatus(conversationId: string, newStatus: Conversation['status'], userId: string) {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('status')
      .eq('id', conversationId)
      .single();

    if (!conversation) throw new Error('Conversation not found');

    const oldStatus = conversation.status;

    // Update conversation status
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ status: newStatus })
      .eq('id', conversationId);

    if (updateError) throw updateError;

    // Create status change event
    const { error: eventError } = await supabase
      .from('chat_events')
      .insert([{
        conversation_id: conversationId,
        event_type: 'status_change',
        created_by: userId,
        old_status: oldStatus,
        new_status: newStatus
      }]);

    if (eventError) throw eventError;
  },

  // Update conversation assignment and create an assignment change event
  async updateConversationAssignment(conversationId: string, newAssigneeId: string | null, userId: string) {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('assigned_to')
      .eq('id', conversationId)
      .single();

    if (!conversation) throw new Error('Conversation not found');

    const oldAssigneeId = conversation.assigned_to;

    // Update conversation assignment
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ assigned_to: newAssigneeId })
      .eq('id', conversationId);

    if (updateError) throw updateError;

    // Create assignment change event
    const { error: eventError } = await supabase
      .from('chat_events')
      .insert([{
        conversation_id: conversationId,
        event_type: 'assignment_change',
        created_by: userId,
        old_assignee: oldAssigneeId,
        new_assignee: newAssigneeId
      }]);

    if (eventError) throw eventError;
  },

  // Get eligible assignees for a conversation (org members)
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
  }
};

// Event Queries
export const eventQueries = {
  // Fetch all events for a conversation
  async getChatEvents(conversationId: string) {
    const { data, error } = await supabase
      .from('chat_events')
      .select(`
        *,
        users!inner (
          id,
          name,
          email
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    return {
      data: data as ChatEventWithUser[] | null,
      error
    };
  },

  // Create a new event
  async createEvent(event: Omit<ChatEvent, 'id' | 'created_at'>) {
    return await supabase
      .from('chat_events')
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
  }
};

// Subscription Helpers
export const subscriptionHelpers = {
  // Subscribe to conversation changes
  subscribeToConversation(conversationId: string, callback: (payload: RealtimePostgresChangesPayload<Conversation>) => void) {
    return supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`
        },
        callback
      )
      .subscribe();
  },

  // Subscribe to chat events
  subscribeToChatEvents(conversationId: string, callback: (payload: RealtimePostgresChangesPayload<ChatEventWithUser>) => void) {
    return supabase
      .channel(`chat-events-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_events',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // For INSERT and UPDATE events, fetch the full event data with user info
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { data } = await supabase
              .from('chat_events')
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
            
            if (data) {
              callback({
                ...payload,
                new: data
              } as RealtimePostgresChangesPayload<ChatEventWithUser>);
              return;
            }
          }
          
          // For DELETE events, just pass through the payload
          callback(payload as RealtimePostgresChangesPayload<ChatEventWithUser>);
        }
      )
      .subscribe();
  }
}; 