import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import Select from '@/components/common/Select';
import { ticketQueries } from '@/utils/sql/ticketQueries';
import { Ticket, Tag } from '@/types/tickets';

interface BulkActionsBarProps {
  selectedTickets: string[];
  onClearSelection: () => void;
  onRefresh?: () => void;
}

export default function BulkActionsBar({
  selectedTickets,
  onClearSelection,
  onRefresh
}: BulkActionsBarProps) {
  const [actionType, setActionType] = useState<'status' | 'priority' | 'assignee' | 'tag' | 'delete'>('status');
  const [newValue, setNewValue] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
    if (actionType === 'delete') {
      setShowDeleteConfirm(true);
      return;
    }

    if ((!newValue.trim() && !isAddingNewTag) || (isAddingNewTag && !newTagValue.trim())) return;
    await performUpdate();
  }

  async function performUpdate() {
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
        case 'delete':
          const { error: deleteError } = await supabase.rpc('bulk_delete_tickets', { 
            ticket_ids: selectedTickets 
          });
          if (deleteError) throw deleteError;
          onRefresh?.();
          break;
      }

      // Clear selection after successful update
      onClearSelection();
      setNewValue('');
      setNewTagValue('');
      setIsAddingNewTag(false);
      setShowDeleteConfirm(false);
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
    <>
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
            { label: 'Change Tag', value: 'tag' },
            { label: 'Delete Tickets', value: 'delete' }
          ]}
        />

        {!isAddingNewTag && actionType !== 'delete' && (
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
          disabled={submitting || (actionType !== 'delete' && (!newValue && !newTagValue) || (isAddingNewTag && !newTagValue))}
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

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedTickets.length} ticket{selectedTickets.length !== 1 ? 's' : ''}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={performUpdate}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 