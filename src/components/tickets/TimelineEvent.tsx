'use client';

import { TicketEventWithUser } from '@/types/tickets';
import { formatCommentDate } from '@/utils/tickets/commentUtils';

interface TimelineEventProps {
  event: TicketEventWithUser;
}

function getDisplayName(event: TicketEventWithUser): string {
  return event.users?.name || 'Unknown User';
}

function formatStatus(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function StatusChangeContent({ event }: { event: TicketEventWithUser & { event_type: 'status_change' } }) {
  return (
    <p className="text-sm text-gray-700">
      Changed status from{' '}
      <span className="font-medium">{formatStatus(event.old_status)}</span>
      {' '}to{' '}
      <span className="font-medium">{formatStatus(event.new_status)}</span>
    </p>
  );
}

function CommentContent({ event }: { event: TicketEventWithUser & { event_type: 'comment' } }) {
  return (
    <p className="text-gray-700 whitespace-pre-wrap">
      {event.comment_text}
    </p>
  );
}

export default function TimelineEvent({ event }: TimelineEventProps) {
  return (
    <div className={`bg-white shadow rounded-lg p-4 ${
      event.event_type === 'status_change' ? 'border-l-4 border-blue-500' : ''
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900">
          {getDisplayName(event)}
        </span>
        <span className="text-sm text-gray-500" title={new Date(event.created_at).toLocaleString()}>
          {formatCommentDate(event.created_at)}
        </span>
      </div>
      
      {event.event_type === 'status_change' ? (
        <StatusChangeContent event={event as TicketEventWithUser & { event_type: 'status_change' }} />
      ) : (
        <CommentContent event={event as TicketEventWithUser & { event_type: 'comment' }} />
      )}
    </div>
  );
} 