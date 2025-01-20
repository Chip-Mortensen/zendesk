'use client';

import { Ticket } from '@/types/tickets';
import { getStatusColor } from '@/utils/tickets/ticketUtils';

interface StatusBadgeProps {
  status: Ticket['status'];
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base'
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${getStatusColor(status)} ${sizeClasses[size]}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
} 