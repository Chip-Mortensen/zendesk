'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Conversation, ChatEventWithUser, ChatMessageEvent } from '@/types/chat';
import { chatQueries, eventQueries } from '@/utils/sql/chatQueries';
import ConversationTimeline from '@/components/chat/ConversationTimeline';
import { formatStatus } from '@/utils/dates';

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [events, setEvents] = useState<ChatEventWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth?type=customer');
        return;
      }

      setCurrentUserId(session.user.id);

      // Get organization ID from the slug
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', params.orgSlug)
        .single();

      if (!orgData) {
        throw new Error('Organization not found');
      }

      // Fetch conversation data
      const { data: conversationData, error: conversationError } = await chatQueries.getConversationById(params.id as string, orgData.id);
      if (conversationError || !conversationData) {
        throw new Error(conversationError?.message || 'Error fetching conversation');
      }
      setConversation(conversationData);

      // Fetch timeline events
      const { data: eventsData, error: eventsError } = await eventQueries.getChatEvents(params.id as string);
      if (eventsError) {
        throw new Error(eventsError.message);
      }
      setEvents(eventsData || []);
    } catch (error) {
      console.error('Error loading conversation details:', error);
      router.push(`/org/${params.orgSlug}/chat`);
    } finally {
      setLoading(false);
    }
  }, [params.id, params.orgSlug, router]);

  useEffect(() => {
    loadData();
    return () => {
      supabase.channel('chat-events').unsubscribe();
    };
  }, [params.id, loadData]);

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
        onClick={() => router.push(`/org/${params.orgSlug}/chat`)}
        className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
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
            <span className="px-3 py-1.5 text-sm font-medium rounded-full capitalize flex items-center" 
              style={{
                backgroundColor: conversation.status === 'open' ? '#E5F6FD' : 
                              conversation.status === 'in_progress' ? '#FDF6B2' : 
                              '#F3F4F6',
                color: conversation.status === 'open' ? '#0284C7' : 
                       conversation.status === 'in_progress' ? '#92400E' : 
                       '#374151'
              }}>
              {formatStatus(conversation.status)}
            </span>
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