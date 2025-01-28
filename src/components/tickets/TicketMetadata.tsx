'use client';

import { Ticket } from '@/types/tickets';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import TagBadge from './TagBadge';

interface TicketMetadataProps {
  status: Ticket['status'];
  priority: Ticket['priority'];
  tagId?: string | null;
  showStatusControl?: boolean;
  showPriorityControl?: boolean;
  showPriorityBadge?: boolean;
  onStatusChange?: (newStatus: Ticket['status']) => void;
  onPriorityChange?: (newPriority: Ticket['priority']) => void;
}

export default function TicketMetadata({
  status,
  priority,
  tagId,
  showStatusControl = false,
  showPriorityControl = false,
  showPriorityBadge = true,
  onStatusChange,
  onPriorityChange
}: TicketMetadataProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center space-x-4">
        <StatusBadge status={status} size="md" />
        {showPriorityBadge && <PriorityBadge priority={priority} size="md" />}
        {tagId && <TagBadge tagId={tagId} size="md" />}
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