import { useMemo } from 'react';
import { isToday, isThisWeek } from 'date-fns';
import FilterDropdown from '../tickets/FilterDropdown';
import { Conversation } from '@/types/chat';

export interface ConversationFilters {
  status: string[];
  assignee: string[];
  created: string[];
}

interface ConversationFiltersProps {
  conversations: Conversation[];
  filters: ConversationFilters;
  onFiltersChange: (filters: ConversationFilters) => void;
}

export default function ConversationFilters({
  conversations,
  filters,
  onFiltersChange
}: ConversationFiltersProps) {
  const filterOptions = useMemo(() => ({
    status: [
      { label: 'Open', value: 'open', count: conversations.filter(t => t.status === 'open').length },
      { label: 'In Progress', value: 'in_progress', count: conversations.filter(t => t.status === 'in_progress').length },
      { label: 'Closed', value: 'closed', count: conversations.filter(t => t.status === 'closed').length }
    ],
    assignee: Array.from(new Set(conversations.map(t => t.assignee?.name)))
      .filter(Boolean)
      .map(name => ({
        label: name!,
        value: name!,
        count: conversations.filter(t => t.assignee?.name === name).length
      })),
    created: [
      { 
        label: 'Today', 
        value: 'today', 
        count: conversations.filter(t => isToday(new Date(t.created_at))).length 
      },
      { 
        label: 'This Week', 
        value: 'this_week', 
        count: conversations.filter(t => isThisWeek(new Date(t.created_at))).length 
      }
    ]
  }), [conversations]);

  const handleFilterChange = (filterType: keyof ConversationFilters) => (values: string[]) => {
    onFiltersChange({
      ...filters,
      [filterType]: values
    });
  };

  return (
    <div className="p-4 border-b border-gray-200 bg-white grid grid-cols-3 gap-4">
      <FilterDropdown
        label="Status"
        options={filterOptions.status}
        selectedValues={filters.status}
        onChange={handleFilterChange('status')}
      />
      <FilterDropdown
        label="Assignee"
        options={filterOptions.assignee}
        selectedValues={filters.assignee}
        onChange={handleFilterChange('assignee')}
      />
      <FilterDropdown
        label="Created"
        options={filterOptions.created}
        selectedValues={filters.created}
        onChange={handleFilterChange('created')}
      />
    </div>
  );
} 