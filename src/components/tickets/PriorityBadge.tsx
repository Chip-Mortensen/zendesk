'use client';

import { Ticket } from '@/types/tickets';

interface PriorityBadgeProps {
  priority: Ticket['priority'];
  size?: 'sm' | 'md' | 'lg';
}

export default function PriorityBadge({ priority, size = 'sm' }: PriorityBadgeProps) {
  const colors = {
    low: 'bg-gray-100 text-gray-800 border-gray-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-red-100 text-red-800 border-red-200'
  };

  const sizeClasses = {
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${colors[priority]} ${sizeClasses[size]}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
} 