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
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import SortableHeader from '@/components/table/SortableHeader';
import ConversationBulkActionsBar from '@/components/chat/ConversationBulkActionsBar';

export default function AdminChatPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings>({});
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc'
  });
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

  // Add new functions for selection handling
  const toggleConversationSelection = (conversationId: string) => {
    setSelectedConversations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(conversationId)) {
        newSet.delete(conversationId);
      } else {
        newSet.add(conversationId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedConversations.size === filteredConversations.length) {
      setSelectedConversations(new Set());
    } else {
      setSelectedConversations(new Set(filteredConversations.map(c => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedConversations(new Set());
  };

  const handleSort = (field: string) => {
    setSortConfig(current => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc'
    }));
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

  const sortedConversations = useMemo(() => {
    return [...filteredConversations].sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      switch (sortConfig.field) {
        case 'subject':
          return direction * a.subject.localeCompare(b.subject);
        case 'status':
          return direction * a.status.localeCompare(b.status);
        case 'assigned_to':
          const aName = a.assignee?.name || '';
          const bName = b.assignee?.name || '';
          return direction * aName.localeCompare(bName);
        case 'created_by':
          const aCreatedBy = a.created_by_user?.name || '';
          const bCreatedBy = b.created_by_user?.name || '';
          return direction * aCreatedBy.localeCompare(bCreatedBy);
        case 'created_at':
          return direction * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        default:
          return 0;
      }
    });
  }, [filteredConversations, sortConfig]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'closed':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

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
      const channelName = `admin-conversations-${organizationId}`;

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations'
          },
          async (payload: RealtimePostgresChangesPayload<{
            id: string;
            [key: string]: unknown;
          }>) => {
            if (payload.eventType === 'DELETE') {
              setConversations(current => current.filter(conv => conv.id !== payload.old.id));
            } else {
              // Fetch the complete conversation data with joined fields
              const { data: updatedData } = await supabase
                .from('conversations')
                .select(`
                  *,
                  assignee:users!conversations_assigned_to_fkey (
                    name
                  ),
                  created_by_user:users!conversations_created_by_fkey (
                    name
                  )
                `)
                .eq('id', payload.new.id)
                .single();

              if (updatedData) {
                setConversations(current =>
                  current.map(conv =>
                    conv.id === updatedData.id ? updatedData : conv
                  )
                );
              }
            }
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [organizationId]);

  if (loading) {
    return <div className="text-center py-12">Loading conversations...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold">Chat Support</h1>
            <p className="mt-1 text-sm text-gray-500">
              View and manage all customer support conversations.
            </p>
          </div>
        </div>

        <div className="border-b border-gray-200">
          <ConversationFilters
            conversations={conversations}
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />
          {selectedConversations.size > 0 && (
            <ConversationBulkActionsBar
              selectedConversations={Array.from(selectedConversations)}
              onClearSelection={clearSelection}
            />
          )}
        </div>

        <div className="max-h-[calc(100vh-24rem)] overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th scope="col" className="relative px-6 py-3">
                  <input
                    type="checkbox"
                    className="absolute left-4 top-1/2 -mt-3 h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedConversations.size === sortedConversations.length && sortedConversations.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <SortableHeader
                  label="Subject"
                  field="subject"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Status"
                  field="status"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Assignee"
                  field="assigned_to"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Created By"
                  field="created_by"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Created"
                  field="created_at"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedConversations.map((conversation) => (
                <tr 
                  key={conversation.id} 
                  className="group transition-colors duration-150 hover:bg-gray-50"
                >
                  <td className="relative px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="absolute left-4 top-1/2 -mt-3 h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedConversations.has(conversation.id)}
                      onChange={() => toggleConversationSelection(conversation.id)}
                    />
                  </td>
                  <td 
                    className="px-6 py-4 cursor-pointer"
                    onClick={() => handleConversationClick(conversation.id)}
                  >
                    <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                      {conversation.subject}
                    </div>
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap cursor-pointer"
                    onClick={() => handleConversationClick(conversation.id)}
                  >
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(conversation.status)}`}>
                      {formatStatus(conversation.status)}
                    </span>
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => handleConversationClick(conversation.id)}
                  >
                    {conversation.assignee?.name || (
                      <span className="text-yellow-600">Unassigned</span>
                    )}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => handleConversationClick(conversation.id)}
                  >
                    {conversation.created_by_user?.name || 'Unknown'}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => handleConversationClick(conversation.id)}
                  >
                    {new Date(conversation.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
