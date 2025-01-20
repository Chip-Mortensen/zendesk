'use client';

import { Ticket } from '@/types/tickets';

interface PriorityBadgeProps {
  priority: Ticket['priority'];
}

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  const colors = {
    low: 'bg-gray-100 text-gray-800 border-gray-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-red-100 text-red-800 border-red-200'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[priority]}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
} 