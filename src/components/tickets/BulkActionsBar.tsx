import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import Select from '@/components/common/Select';
import { ticketQueries } from '@/utils/sql/ticketQueries';
import { Ticket, Tag } from '@/types/tickets';

interface BulkActionsBarProps {
  selectedTickets: string[];
  onClearSelection: () => void;
}

export default function BulkActionsBar({
  selectedTickets,
  onClearSelection
}: BulkActionsBarProps) {
  const [actionType, setActionType] = useState<'status' | 'priority' | 'assignee' | 'tag'>('status');
  const [newValue, setNewValue] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [assignees, setAssignees] = useState<Array<{ id: string; name: string }>>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isAddingNewTag, setIsAddingNewTag] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Load assignees and tags when component mounts
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
          setOrganizationId(memberData.organization_id);
          
          // Load assignees
          const users = await ticketQueries.getEligibleAssignees(memberData.organization_id);
          setAssignees(users);

          // Load tags
          const existingTags = await ticketQueries.getDistinctTags(memberData.organization_id);
          setTags(existingTags);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    }
    loadData();
  }, []);

  // Handle bulk update
  async function handleApply() {
    if ((!newValue.trim() && !isAddingNewTag) || (isAddingNewTag && !newTagValue.trim())) return;

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      if (!organizationId) throw new Error('No organization found');

      switch (actionType) {
        case 'status':
          const { error: statusError } = await ticketQueries.bulkUpdateStatus(selectedTickets, newValue as Ticket['status'], user.id);
          if (statusError) throw statusError;
          break;
        case 'priority':
          const { error: priorityError } = await ticketQueries.bulkUpdatePriority(selectedTickets, newValue as Ticket['priority'], user.id);
          if (priorityError) throw priorityError;
          break;
        case 'assignee':
          const { error: assigneeError } = await ticketQueries.bulkUpdateAssignment(selectedTickets, newValue, user.id);
          if (assigneeError) throw assigneeError;
          break;
        case 'tag':
          if (isAddingNewTag) {
            // Create new tag first
            const newTag = await ticketQueries.createTag(newTagValue, organizationId);
            const { error } = await ticketQueries.bulkUpdateTag(selectedTickets, newTag.id, user.id);
            if (error) throw error;
            setTags(prev => [...prev, newTag]);
          } else {
            const { error } = await ticketQueries.bulkUpdateTag(selectedTickets, newValue || null, user.id);
            if (error) throw error;
          }
          break;
      }

      // Clear selection after successful update
      onClearSelection();
      setNewValue('');
      setNewTagValue('');
      setIsAddingNewTag(false);
    } catch (error) {
      console.error('Bulk update error:', error);
      alert(error instanceof Error ? error.message : 'Something went wrong when applying bulk actions');
    } finally {
      setSubmitting(false);
    }
  }

  // Get options based on action type
  const getOptions = () => {
    switch (actionType) {
      case 'status':
        return [
          { label: 'Open', value: 'open' },
          { label: 'In Progress', value: 'in_progress' },
          { label: 'Closed', value: 'closed' }
        ];
      case 'priority':
        return [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' }
        ];
      case 'assignee':
        return [
          { label: 'Unassigned', value: 'unassigned' },
          ...assignees.map(a => ({ label: a.name, value: a.id }))
        ];
      case 'tag':
        return [
          { label: 'No tag', value: '' },
          ...tags.map(tag => ({ label: tag.name, value: tag.id })),
          { label: '+ Add new tag', value: 'new' }
        ];
      default:
        return [];
    }
  };

  // Handle tag selection
  const handleValueChange = (value: string) => {
    if (actionType === 'tag' && value === 'new') {
      setIsAddingNewTag(true);
      setNewValue('');
    } else {
      setNewValue(value);
      setIsAddingNewTag(false);
    }
  };

  return (
    <div className="bg-blue-50 border-t border-b border-blue-100 py-2 px-4 flex items-center gap-4">
      <span className="text-sm font-medium text-blue-700">
        {selectedTickets.length}
      </span>

      <Select
        value={actionType}
        onChange={(val) => {
          setActionType(val as typeof actionType);
          setNewValue('');
          setIsAddingNewTag(false);
          setNewTagValue('');
        }}
        options={[
          { label: 'Change Status', value: 'status' },
          { label: 'Change Priority', value: 'priority' },
          { label: 'Change Assignee', value: 'assignee' },
          { label: 'Change Tag', value: 'tag' }
        ]}
      />

      {!isAddingNewTag && (
        <Select
          value={newValue}
          onChange={handleValueChange}
          options={getOptions()}
          placeholder={`Select ${actionType}`}
        />
      )}

      {isAddingNewTag && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newTagValue}
            onChange={(e) => setNewTagValue(e.target.value)}
            placeholder="Enter new tag"
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={() => setIsAddingNewTag(false)}
            className="px-2 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}

      <button
        onClick={handleApply}
        disabled={submitting || (!newValue && !newTagValue) || (isAddingNewTag && !newTagValue)}
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