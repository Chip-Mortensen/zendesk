'use client';

import { TicketEventWithUser } from '@/types/tickets';
import { formatCommentDate } from '@/utils/tickets/commentUtils';
import PriorityBadge from './PriorityBadge';

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

function PriorityChangeContent({ event }: { event: TicketEventWithUser & { event_type: 'priority_change' } }) {
  return (
    <p className="text-sm text-gray-700">
      Changed priority from <PriorityBadge priority={event.old_priority} /> to <PriorityBadge priority={event.new_priority} />
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

function NoteContent({ event }: { event: TicketEventWithUser & { event_type: 'note' } }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-gray-500">Internal Note</div>
      <p className="text-gray-700 whitespace-pre-wrap">
        {event.comment_text}
      </p>
    </div>
  );
}

export default function TimelineEvent({ event }: TimelineEventProps) {
  const getBorderColor = () => {
    switch (event.event_type) {
      case 'status_change':
        return 'border-blue-500';
      case 'priority_change':
        return 'border-yellow-500';
      case 'note':
        return 'border-gray-500';
      default:
        return '';
    }
  };

  const getBackgroundColor = () => {
    return event.event_type === 'note' ? 'bg-gray-50' : 'bg-white';
  };

  return (
    <div className={`shadow rounded-lg p-4 ${getBackgroundColor()} ${
      event.event_type !== 'comment' ? `border-l-4 ${getBorderColor()}` : ''
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
      ) : event.event_type === 'priority_change' ? (
        <PriorityChangeContent event={event as TicketEventWithUser & { event_type: 'priority_change' }} />
      ) : event.event_type === 'note' ? (
        <NoteContent event={event as TicketEventWithUser & { event_type: 'note' }} />
      ) : (
        <CommentContent event={event as TicketEventWithUser & { event_type: 'comment' }} />
      )}
    </div>
  );
} 