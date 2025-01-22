'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Conversation, ChatEventWithUser, ChatMessageEvent } from '@/types/chat';
import { chatQueries, eventQueries } from '@/utils/sql/chatQueries';
import ConversationTimeline from '@/components/chat/ConversationTimeline';
import Select from '@/components/common/Select';

export default function AdminConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [events, setEvents] = useState<ChatEventWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  async function handleStatusChange(value: string) {
    if (!conversation || updating) return;
    const newStatus = value as 'open' | 'in_progress' | 'closed';
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

  async function handleAssigneeChange(value: string) {
    if (!conversation || updating) return;
    const newAssigneeId = value || null;
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

  async function handleDelete() {
    if (!conversation) return;
    try {
      await chatQueries.deleteConversation(conversation.id);
      router.push('/dashboard/chat');
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  }

  if (loading) {
    return <div className="p-6">Loading conversation...</div>;
  }

  if (!conversation) {
    return null;
  }

  return (
    <>
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
                <Select
                  label="Status"
                  value={conversation.status}
                  options={[
                    { label: 'Open', value: 'open' },
                    { label: 'In Progress', value: 'in_progress' },
                    { label: 'Resolved', value: 'resolved' }
                  ]}
                  onChange={handleStatusChange}
                  isLoading={updating}
                />

                <Select
                  label="Assignee"
                  value={conversation.assigned_to || ''}
                  options={[
                    { label: 'Unassigned', value: '' },
                    ...assignees.map(assignee => ({
                      label: assignee.name,
                      value: assignee.id
                    }))
                  ]}
                  onChange={handleAssigneeChange}
                  isLoading={updating}
                />

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
                  title="Delete conversation"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd" />
                  </svg>
                </button>
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

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-sm mx-auto">
            <h3 className="text-lg font-medium mb-4">Delete Conversation</h3>
            <p className="text-gray-500 mb-4">
              Are you sure you want to delete this conversation? This action cannot be undone.
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