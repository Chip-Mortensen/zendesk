'use client';

import { useEffect, useState } from 'react';
import { Ticket } from '@/types/tickets';
import { ticketQueries } from '@/utils/sql/ticketQueries';
import { supabase } from '@/utils/supabase';

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

const selectClassName = "w-[180px] rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500";

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

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">Ticket Actions</h3>
      </div>
      <div className="px-4 py-3 space-y-4">
        <div className="flex items-center justify-between">
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="status"
            value={ticket.status}
            onChange={(e) => onStatusChange(e.target.value as Ticket['status'])}
            className={selectClassName}
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
            Priority
          </label>
          <select
            id="priority"
            value={ticket.priority}
            onChange={(e) => onPriorityChange(e.target.value as Ticket['priority'])}
            className={selectClassName}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label htmlFor="assignee" className="block text-sm font-medium text-gray-700">
            Assignee
          </label>
          {loadingAssignees ? (
            <div className="text-sm text-gray-500 w-[180px] text-right">Loading...</div>
          ) : ticket.assigned_to ? (
            <select
              id="assignee"
              value={ticket.assigned_to}
              onChange={(e) => onAssigneeChange(e.target.value)}
              className={selectClassName}
            >
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              id="assignee"
              value=""
              onChange={(e) => onAssigneeChange(e.target.value)}
              className={selectClassName}
            >
              <option value="" disabled>Select assignee</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center justify-between">
          <label htmlFor="tag" className="block text-sm font-medium text-gray-700">
            Tag
          </label>
          {loadingTags ? (
            <div className="text-sm text-gray-500 w-[180px] text-right">Loading...</div>
          ) : isAddingNewTag ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="w-[140px] h-9 rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="New tag"
              />
              <button
                onClick={handleNewTagSubmit}
                className="h-9 px-3 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Add
              </button>
              <button
                onClick={() => setIsAddingNewTag(false)}
                className="h-9 px-3 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <select
              id="tag"
              value={ticket.tag || ''}
              onChange={(e) => handleTagChange(e.target.value)}
              className={selectClassName}
            >
              <option value="">No tag</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
              <option value="new">+ Add new tag</option>
            </select>
          )}
        </div>
      </div>
    </div>
  );
} 