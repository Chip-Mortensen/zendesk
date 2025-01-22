'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Conversation } from '@/types/chat';
import { chatQueries } from '@/utils/sql/chatQueries';
import { formatStatus } from '@/utils/dates';

export default function AdminChatPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth?type=admin');
        return;
      }

      // Get user's organization
      const { data: memberData } = await supabase
        .from('org_members')
        .select('organization_id, role')
        .eq('user_id', session.user.id)
        .in('role', ['admin', 'employee'])
        .single();

      if (!memberData?.organization_id) {
        router.push('/auth?type=admin');
        return;
      }

      setOrganizationId(memberData.organization_id);

      // Load conversations
      const { data } = await chatQueries.getOrgConversations(memberData.organization_id);
      if (data) {
        setConversations(data);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleConversationClick = useCallback((conversationId: string) => {
    router.push(`/dashboard/chat/${conversationId}`);
  }, [router]);

  useEffect(() => {
    loadData();
    return () => {
      // Cleanup subscription on unmount
      if (organizationId) {
        supabase.channel('conversations').unsubscribe();
      }
    };
  }, [loadData, organizationId]);

  useEffect(() => {
    if (organizationId) {
      // Subscribe to changes
      const channel = supabase
        .channel('conversations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: `organization_id=eq.${organizationId}`
          },
          () => {
            loadData();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [organizationId, loadData]);

  if (loading) {
    return <div className="p-6">Loading conversations...</div>;
  }

  return (
    <div>
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold">Chat Support</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage all customer support conversations.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {conversations.length === 0 ? (
            <p className="p-6 text-gray-500">No conversations yet.</p>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="p-6 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleConversationClick(conversation.id)}
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">{conversation.subject}</h3>
                  <div className="flex items-center space-x-3">
                    {!conversation.assigned_to && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full text-yellow-800 bg-yellow-100">
                        Unassigned
                      </span>
                    )}
                    {conversation.assigned_to && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full text-blue-800 bg-blue-100">
                        {conversation.assignee?.name}
                      </span>
                    )}
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
