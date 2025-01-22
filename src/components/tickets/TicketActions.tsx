'use client';

import { useEffect, useState } from 'react';
import { Ticket } from '@/types/tickets';
import { ticketQueries } from '@/utils/sql/ticketQueries';
import { supabase } from '@/utils/supabase';
import Select from '@/components/common/Select';

interface User {
  id: string;
  name: string;
  email: string;
}

interface TicketActionsProps {
  ticket: Ticket;
  onStatusChange: (newStatus: Ticket['status']) => void;
  onPriorityChange: (newPriority: Ticket['priority']) => void;
  onAssigneeChange: (newAssigneeId: string | null) => void;
}

export default function TicketActions({
  ticket,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
}: TicketActionsProps) {
  const [assignees, setAssignees] = useState<User[]>([]);
  const [loadingAssignees, setLoadingAssignees] = useState(true);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [newTag, setNewTag] = useState('');
  const [isAddingNewTag, setIsAddingNewTag] = useState(false);

  useEffect(() => {
    async function loadAssignees() {
      try {
        const data = await ticketQueries.getEligibleAssignees(ticket.organization_id);
        // Each member.users contains the user data we need
        setAssignees(data.map(user => ({
          id: user.id || '',
          name: user.name || '',
          email: user.email || ''
        })));
      } catch (error) {
        console.error('Error loading assignees:', error);
      } finally {
        setLoadingAssignees(false);
      }
    }

    async function loadTags() {
      try {
        const tags = await ticketQueries.getDistinctTags(ticket.organization_id);
        setAvailableTags(tags);
      } catch (error) {
        console.error('Error loading tags:', error);
      } finally {
        setLoadingTags(false);
      }
    }

    if (ticket.organization_id) {
      loadAssignees();
      loadTags();
    }
  }, [ticket.organization_id]);

  const handleTagChange = async (value: string) => {
    if (value === 'new') {
      setIsAddingNewTag(true);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      await ticketQueries.updateTicketTag(ticket.id, value, user.id);
    } catch (error) {
      console.error('Error updating tag:', error);
    }
  };

  const handleNewTagSubmit = async () => {
    if (!newTag.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      await ticketQueries.updateTicketTag(ticket.id, newTag.trim(), user.id);
      setAvailableTags(prev => [...prev, newTag.trim()]);
      setNewTag('');
      setIsAddingNewTag(false);
    } catch (error) {
      console.error('Error adding new tag:', error);
    }
  };

  const statusOptions = [
    { label: 'Open', value: 'open' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Closed', value: 'closed' }
  ];

  const priorityOptions = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' }
  ];

  const assigneeOptions = assignees.map(assignee => ({
    label: assignee.name,
    value: assignee.id
  }));

  const tagOptions = [
    { label: 'No tag', value: '' },
    ...availableTags.map(tag => ({ label: tag, value: tag })),
    { label: '+ Add new tag', value: 'new' }
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <Select
          label="Status"
          value={ticket.status}
          options={statusOptions}
          onChange={(value) => onStatusChange(value as Ticket['status'])}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Priority
        </label>
        <Select
          label="Priority"
          value={ticket.priority}
          options={priorityOptions}
          onChange={(value) => onPriorityChange(value as Ticket['priority'])}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Assignee
        </label>
        <Select
          label="Assignee"
          value={ticket.assigned_to || ''}
          options={assigneeOptions}
          onChange={(value) => onAssigneeChange(value)}
          isLoading={loadingAssignees}
          placeholder="Select assignee"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tag
        </label>
        {isAddingNewTag ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="New tag"
            />
            <button
              onClick={handleNewTagSubmit}
              className="px-2 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 shrink-0"
            >
              Add
            </button>
            <button
              onClick={() => setIsAddingNewTag(false)}
              className="px-2 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 shrink-0"
            >
              ×
            </button>
          </div>
        ) : (
          <Select
            label="Tag"
            value={ticket.tag || ''}
            options={tagOptions}
            onChange={handleTagChange}
            isLoading={loadingTags}
          />
        )}
      </div>
    </div>
  );
} 