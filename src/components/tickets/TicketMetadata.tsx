'use client';

import { Ticket } from '@/types/tickets';
import { formatTicketDate } from '@/utils/tickets/ticketUtils';
import StatusBadge from './StatusBadge';

interface TicketMetadataProps {
  createdAt: string;
  status: Ticket['status'];
  showStatusControl?: boolean;
  onStatusChange?: (newStatus: Ticket['status']) => void;
}

export default function TicketMetadata({
  createdAt,
  status,
  showStatusControl = false,
  onStatusChange
}: TicketMetadataProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <StatusBadge status={status} />
        <span className="text-sm text-gray-500">
          Created on {formatTicketDate(createdAt)}
        </span>
      </div>
      {showStatusControl && onStatusChange && (
        <div className="flex items-center space-x-2">
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as Ticket['status'])}
            className="rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      )}
    </div>
  );
} 