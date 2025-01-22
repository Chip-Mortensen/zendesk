'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Conversation } from '@/types/chat';
import { chatQueries } from '@/utils/sql/chatQueries';
import { formatStatus } from '@/utils/dates';

export default function CustomerChatPage() {
  const params = useParams();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadConversations();
    return () => {
      supabase.channel('conversations').unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function setupSubscription() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const channel = supabase
          .channel('conversations')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'conversations',
              filter: `created_by=eq.${user.id}`
            },
            () => {
              loadConversations();
            }
          )
          .subscribe();

        return () => {
          channel.unsubscribe();
        };
      }
    }
    setupSubscription();
  }, []);

  async function loadConversations() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get organization ID from the slug
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', params.orgSlug)
        .single();

      if (!orgData) return;

      const { data } = await chatQueries.getUserConversations(user.id, orgData.id);
      if (data) {
        setConversations(data);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateConversation(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || creating) return;

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get organization ID from the slug
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', params.orgSlug)
        .single();

      if (!orgData) throw new Error('Organization not found');

      const { data, error } = await chatQueries.createConversation({
        subject: subject.trim(),
        organization_id: orgData.id,
        created_by: user.id,
        status: 'open',
        assigned_to: null
      });

      if (error) throw error;
      if (!data) throw new Error('No conversation data returned');

      setSubject('');
      // Redirect to the new conversation
      router.push(`/org/${params.orgSlug}/chat/${data.id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
    } finally {
      setCreating(false);
    }
  }

  function handleConversationClick(conversationId: string) {
    router.push(`/org/${params.orgSlug}/chat/${conversationId}`);
  }

  if (loading) {
    return <div className="p-6">Loading conversations...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Chat Support</h1>
        
        <form onSubmit={handleCreateConversation} className="bg-white shadow-lg rounded-xl p-6 mb-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-blue-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h2 className="text-lg font-semibold">Start a New Conversation</h2>
            </div>
            
            <div className="relative">
              <input
                type="text"
                id="subject"
                name="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What would you like to discuss?"
                className="block w-full rounded-xl border-0 py-3.5 pl-4 pr-12 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <button
                  type="submit"
                  disabled={creating || !subject.trim()}
                  className="inline-flex items-center justify-center rounded-lg p-2 text-blue-600 hover:text-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-500">
              Our support team typically responds within a few hours during business hours.
            </p>
          </div>
        </form>

        <div className="bg-white shadow rounded-lg divide-y">
          {conversations.length === 0 ? (
            <p className="p-4 text-gray-500">No conversations yet. Start one above!</p>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleConversationClick(conversation.id)}
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">{conversation.subject}</h3>
                  <span className="px-2 py-1 text-xs font-medium rounded-full capitalize" 
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
                <p className="mt-1 text-sm text-gray-500">
                  Started {new Date(conversation.created_at).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 