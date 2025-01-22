import { useMemo } from 'react';
import { isToday, isThisWeek } from 'date-fns';
import FilterDropdown from './FilterDropdown';
import { Ticket } from '@/types/tickets';

export interface TicketFilters {
  status: string[];
  priority: string[];
  assignee: string[];
  customer: string[];
  tag: string[];
  created: string[];
}

interface TicketFiltersProps {
  tickets: Ticket[];
  filters: TicketFilters;
  onFiltersChange: (filters: TicketFilters) => void;
}

export default function TicketFilters({
  tickets,
  filters,
  onFiltersChange
}: TicketFiltersProps) {
  const filterOptions = useMemo(() => ({
    status: [
      { label: 'Open', value: 'open', count: tickets.filter(t => t.status === 'open').length },
      { label: 'In Progress', value: 'in_progress', count: tickets.filter(t => t.status === 'in_progress').length },
      { label: 'Closed', value: 'closed', count: tickets.filter(t => t.status === 'closed').length }
    ],
    priority: [
      { label: 'High', value: 'high', count: tickets.filter(t => t.priority === 'high').length },
      { label: 'Medium', value: 'medium', count: tickets.filter(t => t.priority === 'medium').length },
      { label: 'Low', value: 'low', count: tickets.filter(t => t.priority === 'low').length }
    ],
    assignee: Array.from(new Set(tickets.map(t => t.assignee?.name)))
      .filter(Boolean)
      .map(name => ({
        label: name!,
        value: name!,
        count: tickets.filter(t => t.assignee?.name === name).length
      })),
    customer: Array.from(new Set(tickets.map(t => t.customer?.name)))
      .filter(Boolean)
      .map(name => ({
        label: name!,
        value: name!,
        count: tickets.filter(t => t.customer?.name === name).length
      })),
    tag: Array.from(new Set(tickets.map(t => t.tag)))
      .filter(Boolean)
      .map(tag => ({
        label: tag!,
        value: tag!,
        count: tickets.filter(t => t.tag === tag).length
      })),
    created: [
      { 
        label: 'Today', 
        value: 'today', 
        count: tickets.filter(t => isToday(new Date(t.created_at))).length 
      },
      { 
        label: 'This Week', 
        value: 'this_week', 
        count: tickets.filter(t => isThisWeek(new Date(t.created_at))).length 
      }
    ]
  }), [tickets]);

  const handleFilterChange = (filterType: keyof TicketFilters) => (values: string[]) => {
    onFiltersChange({
      ...filters,
      [filterType]: values
    });
  };

  return (
    <div className="p-4 border-b border-gray-200 bg-white grid grid-cols-6 gap-4">
      <FilterDropdown
        label="Status"
        options={filterOptions.status}
        selectedValues={filters.status}
        onChange={handleFilterChange('status')}
      />
      <FilterDropdown
        label="Priority"
        options={filterOptions.priority}
        selectedValues={filters.priority}
        onChange={handleFilterChange('priority')}
      />
      <FilterDropdown
        label="Assignee"
        options={filterOptions.assignee}
        selectedValues={filters.assignee}
        onChange={handleFilterChange('assignee')}
      />
      <FilterDropdown
        label="Customer"
        options={filterOptions.customer}
        selectedValues={filters.customer}
        onChange={handleFilterChange('customer')}
      />
      <FilterDropdown
        label="Tag"
        options={filterOptions.tag}
        selectedValues={filters.tag}
        onChange={handleFilterChange('tag')}
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