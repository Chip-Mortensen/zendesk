'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Conversation } from '@/types/chat';
import { chatQueries } from '@/utils/sql/chatQueries';
import { formatStatus } from '@/utils/dates';
import { isToday, isThisWeek } from 'date-fns';
import ConversationFilters, { ConversationFilters as ConversationFiltersType } from '@/components/chat/ConversationFilters';
import { userQueries } from '@/utils/sql/userQueries';
import { UserSettings } from '@/types/settings';

export default function AdminChatPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings>({});
  const [filters, setFilters] = useState<ConversationFiltersType>({
    status: [],
    assignee: [],
    created: []
  });

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth?type=admin');
        return;
      }

      setUserId(session.user.id);

      // Load user settings
      try {
        const settings = await userQueries.getUserSettings(session.user.id);
        if (settings?.conversation_filters) {
          setFilters(settings.conversation_filters);
          setUserSettings(settings);
        }
      } catch (error) {
        console.error('Error loading user settings:', error);
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

  const handleFiltersChange = async (newFilters: ConversationFiltersType) => {
    if (!userId) {
      console.error('No user ID available when trying to save filters');
      return;
    }
    
    setFilters(newFilters);
    
    try {
      // Preserve existing settings and only update conversation filters
      const newSettings: UserSettings = {
        ...userSettings,  // Keep all existing settings
        conversation_filters: newFilters  // Only update conversation filters
      };
      
      // Get the latest settings before updating to ensure we have the most recent ticket filters
      const currentSettings = await userQueries.getUserSettings(userId);
      
      // Merge everything together, prioritizing our new conversation filters
      const mergedSettings: UserSettings = {
        ...currentSettings,  // Start with current settings from DB
        ...newSettings,      // Add our new settings
        ticket_filters: currentSettings.ticket_filters || userSettings.ticket_filters  // Explicitly preserve ticket filters
      };
      
      await userQueries.updateUserSettings(userId, mergedSettings);
      setUserSettings(mergedSettings);
    } catch (error) {
      console.error('Error saving filters:', error);
    }
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter(conversation => {
      const matchesStatus = filters.status.length === 0 || filters.status.includes(conversation.status);
      const matchesAssignee = filters.assignee.length === 0 || filters.assignee.includes(conversation.assignee?.name || '');
      const matchesCreated = filters.created.length === 0 || filters.created.some(dateFilter => {
        if (dateFilter === 'today') return isToday(new Date(conversation.created_at));
        if (dateFilter === 'this_week') return isThisWeek(new Date(conversation.created_at));
        return true;
      });

      return matchesStatus && matchesAssignee && matchesCreated;
    });
  }, [conversations, filters]);

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

        <div className="border-b border-gray-200">
          <ConversationFilters
            conversations={conversations}
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />
        </div>

        <div className="max-h-[calc(100vh-24rem)] overflow-auto">
          <div className="divide-y divide-gray-200">
            {filteredConversations.length === 0 ? (
              <p className="p-6 text-gray-500">No conversations found.</p>
            ) : (
              filteredConversations.map((conversation) => (
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
    </div>
  );
}
