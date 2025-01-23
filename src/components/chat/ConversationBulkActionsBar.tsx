import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import Select from '@/components/common/Select';
import { chatQueries } from '@/utils/sql/chatQueries';

interface ConversationBulkActionsBarProps {
  selectedConversations: string[];
  onClearSelection: () => void;
}

export default function ConversationBulkActionsBar({
  selectedConversations,
  onClearSelection
}: ConversationBulkActionsBarProps) {
  const [actionType, setActionType] = useState<'status' | 'assignee'>('status');
  const [newValue, setNewValue] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [assignees, setAssignees] = useState<Array<{ id: string; name: string }>>([]);

  // Load assignees when component mounts
  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: memberData } = await supabase
          .from('org_members')
          .select('organization_id')
          .eq('user_id', session.user.id)
          .single();

        if (memberData) {
          // Load assignees
          const users = await chatQueries.getEligibleAssignees(memberData.organization_id);
          setAssignees(users);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    }
    loadData();
  }, []);

  async function handleApply() {
    if (!newValue.trim()) return;

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      let result;
      switch (actionType) {
        case 'status':
          result = await chatQueries.bulkUpdateStatus(selectedConversations, newValue, user.id);
          break;
        case 'assignee':
          result = await chatQueries.bulkUpdateAssignment(selectedConversations, newValue, user.id);
          break;
      }

      if (result?.error) {
        throw new Error(`Failed to update conversations: ${result.error.message || 'Unknown error'}`);
      }

      if (!result?.data?.success) {
        throw new Error(result?.data?.message || 'Update failed');
      }

      onClearSelection();
      setNewValue('');
    } catch (error) {
      console.error('Bulk update error:', error);
      alert(error instanceof Error ? error.message : 'Something went wrong when applying bulk actions');
    } finally {
      setSubmitting(false);
    }
  }

  const getOptions = () => {
    switch (actionType) {
      case 'status':
        return [
          { label: 'Open', value: 'open' },
          { label: 'In Progress', value: 'in_progress' },
          { label: 'Closed', value: 'closed' }
        ];
      case 'assignee':
        return [
          { label: 'Unassigned', value: 'unassigned' },
          ...assignees.map(a => ({ label: a.name, value: a.id }))
        ];
      default:
        return [];
    }
  };

  return (
    <div className="bg-blue-50 border-t border-b border-blue-100 py-2 px-4 flex items-center gap-4">
      <span className="text-sm font-medium text-blue-700">
        {selectedConversations.length}
      </span>

      <Select
        value={actionType}
        onChange={(val) => {
          setActionType(val as typeof actionType);
          setNewValue('');
        }}
        options={[
          { label: 'Change Status', value: 'status' },
          { label: 'Change Assignee', value: 'assignee' }
        ]}
      />

      <Select
        value={newValue}
        onChange={(val) => setNewValue(val)}
        options={getOptions()}
        placeholder={`Select ${actionType}`}
      />

      <button
        onClick={handleApply}
        disabled={submitting || !newValue}
        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Updating...' : 'Apply'}
      </button>

      <button
        onClick={onClearSelection}
        className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
      >
        Cancel
      </button>
    </div>
  );
} 