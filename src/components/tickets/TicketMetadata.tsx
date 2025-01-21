'use client';

import { Ticket } from '@/types/tickets';
import { formatTicketDate } from '@/utils/tickets/ticketUtils';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import TagBadge from './TagBadge';

interface TicketMetadataProps {
  createdAt: string;
  status: Ticket['status'];
  priority: Ticket['priority'];
  tag?: string | null;
  showStatusControl?: boolean;
  showPriorityControl?: boolean;
  onStatusChange?: (newStatus: Ticket['status']) => void;
  onPriorityChange?: (newPriority: Ticket['priority']) => void;
}

export default function TicketMetadata({
  createdAt,
  status,
  priority,
  tag,
  showStatusControl = false,
  showPriorityControl = false,
  onStatusChange,
  onPriorityChange
}: TicketMetadataProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center space-x-4">
        <StatusBadge status={status} />
        <PriorityBadge priority={priority} />
        {tag && <TagBadge tag={tag} />}
        <span className="text-sm text-gray-500">
          Created on {formatTicketDate(createdAt)}
        </span>
      </div>
      <div className="flex items-center gap-4">
        {showStatusControl && onStatusChange && (
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as Ticket['status'])}
            className="rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
        )}
        {showPriorityControl && onPriorityChange && (
          <select
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value as Ticket['priority'])}
            className="rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>
        )}
      </div>
    </div>
  );
} 