'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Conversation, ChatEventWithUser, ChatMessageEvent } from '@/types/chat';
import { chatQueries, eventQueries } from '@/utils/sql/chatQueries';
import ConversationTimeline from '@/components/chat/ConversationTimeline';

export default function AdminConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [events, setEvents] = useState<ChatEventWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<Array<{ id: string; name: string; email: string }>>([]);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      setCurrentUserId(user.id);

      // Load conversation and events
      const [conversationData, eventsData] = await Promise.all([
        chatQueries.getConversationById(params.id as string),
        eventQueries.getChatEvents(params.id as string)
      ]);

      if (!conversationData.data) {
        router.push('/dashboard/chat');
        return;
      }

      setConversation(conversationData.data);
      if (eventsData.data) {
        setEvents(eventsData.data);
      }

      // Fetch eligible assignees
      const assigneeData = await chatQueries.getEligibleAssignees(conversationData.data.organization_id);
      setAssignees(assigneeData);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (conversation?.id) {
      const channel = supabase
        .channel('chat-events')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_events',
            filter: `conversation_id=eq.${conversation.id}`
          },
          async () => {
            // Reload events when any change occurs
            const { data: eventsData, error: eventsError } = await eventQueries.getChatEvents(conversation.id);
            if (!eventsError && eventsData) {
              setEvents(eventsData);
            }
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [conversation?.id]);

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!conversation || updating) return;
    const newStatus = e.target.value as 'open' | 'in_progress' | 'closed';
    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await chatQueries.updateConversationStatus(conversation.id, newStatus, user.id);
      setConversation({ ...conversation, status: newStatus });
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdating(false);
    }
  }

  async function handleAssigneeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!conversation || updating) return;
    const newAssigneeId = e.target.value || null;
    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await chatQueries.updateConversationAssignment(conversation.id, newAssigneeId, user.id);
      setConversation({ ...conversation, assigned_to: newAssigneeId });
    } catch (error) {
      console.error('Error updating assignment:', error);
    } finally {
      setUpdating(false);
    }
  }

  async function handleSendMessage(message: string) {
    if (!conversation) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await eventQueries.createEvent({
        conversation_id: conversation.id,
        event_type: 'message',
        created_by: user.id,
        message_text: message
      } as Omit<ChatMessageEvent, 'id' | 'created_at'>);

      // Refresh events
      const { data } = await eventQueries.getChatEvents(conversation.id);
      if (data) {
        setEvents(data);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  if (loading) {
    return <div className="p-6">Loading conversation...</div>;
  }

  if (!conversation) {
    return null;
  }

  return (
    <div>
      <button
        onClick={() => router.push('/dashboard/chat')}
        className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Conversations
      </button>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{conversation.subject}</h1>
              <p className="mt-1 text-sm text-gray-500">
                Started {new Date(conversation.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={conversation.status}
                onChange={handleStatusChange}
                disabled={updating}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>

              <select
                value={conversation.assigned_to || ''}
                onChange={handleAssigneeChange}
                disabled={updating}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <ConversationTimeline
          conversation={conversation}
          events={events}
          currentUserId={currentUserId}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
} 