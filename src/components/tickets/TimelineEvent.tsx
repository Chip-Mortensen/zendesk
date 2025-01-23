'use client';

import { useEffect, useState } from 'react';
import { TicketEventWithUser } from '@/types/tickets';
import { formatCommentDate } from '@/utils/tickets/commentUtils';
import PriorityBadge from './PriorityBadge';
import { supabase } from '@/utils/supabase';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

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

function AssignmentChangeContent({ event }: { event: TicketEventWithUser & { event_type: 'assignment_change' } }) {
  const [oldAssigneeName, setOldAssigneeName] = useState<string | null>(null);
  const [newAssigneeName, setNewAssigneeName] = useState<string | null>(null);

  useEffect(() => {
    async function loadUserNames() {
      try {
        if (event.old_assignee) {
          const { data: oldUser } = await supabase
            .from('users')
            .select('name')
            .eq('id', event.old_assignee)
            .single();
          if (oldUser) setOldAssigneeName(oldUser.name);
        }

        const { data: newUser } = await supabase
          .from('users')
          .select('name')
          .eq('id', event.new_assignee)
          .single();
        if (newUser) setNewAssigneeName(newUser.name);
      } catch (error) {
        console.error('Error loading user names:', error);
      }
    }

    loadUserNames();
  }, [event.old_assignee, event.new_assignee]);

  if (!newAssigneeName) {
    return <p className="text-sm text-gray-700">Loading...</p>;
  }

  return (
    <p className="text-sm text-gray-700">
      {event.old_assignee ? (
        <>
          Changed assignee from <span className="font-medium">{oldAssigneeName || 'Unknown'}</span> to{' '}
          <span className="font-medium">{newAssigneeName}</span>
        </>
      ) : (
        <>
          Assigned ticket to <span className="font-medium">{newAssigneeName}</span>
        </>
      )}
    </p>
  );
}

function CommentContent({ event }: { event: TicketEventWithUser & { event_type: 'comment' } }) {
  return (
    <p className="text-sm text-gray-700 whitespace-pre-wrap">
      {event.comment_text}
    </p>
  );
}

function NoteContent({ event }: { event: TicketEventWithUser & { event_type: 'note' } }) {
  return (
    <div className="text-sm text-gray-700">
      <p className="italic mb-1">Internal Note:</p>
      <p className="whitespace-pre-wrap">{event.comment_text}</p>
    </div>
  );
}

function TagChangeContent({ event }: { event: TicketEventWithUser & { event_type: 'tag_change' } }) {
  return (
    <p className="text-sm text-gray-700">
      {event.old_value ? (
        <>Changed tag from &ldquo;{event.old_value}&rdquo; to &ldquo;{event.new_value}&rdquo;</>
      ) : (
        <>Added tag &ldquo;{event.new_value}&rdquo;</>
      )}
    </p>
  );
}

function RatingContent({ event }: { event: TicketEventWithUser & { event_type: 'rating' } }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((star) => (
            <StarIconSolid
              key={star}
              className={`w-5 h-5 ${star <= event.rating_value ? 'text-yellow-400' : 'text-gray-200'}`}
            />
          ))}
        </div>
        <span className="text-sm text-gray-600 ml-2">
          Rated {event.rating_value} out of 5 stars
        </span>
      </div>
      {event.rating_comment && (
        <p className="text-gray-700 text-sm mt-1">
          &ldquo;{event.rating_comment}&rdquo;
        </p>
      )}
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
      case 'assignment_change':
        return 'border-purple-500';
      case 'note':
        return 'border-gray-500';
      case 'tag_change':
        return 'border-blue-500';
      case 'rating':
        return 'border-yellow-400';
      default:
        return '';
    }
  };

  const getBackgroundColor = () => {
    if (event.event_type === 'note') return 'bg-gray-50';
    if (event.event_type === 'rating') return 'bg-yellow-50';
    return 'bg-white';
  };

  const renderEventContent = () => {
    switch (event.event_type) {
      case 'status_change':
        return <StatusChangeContent event={event} />;
      case 'priority_change':
        return <PriorityChangeContent event={event} />;
      case 'assignment_change':
        return <AssignmentChangeContent event={event} />;
      case 'note':
        return <NoteContent event={event} />;
      case 'tag_change':
        return <TagChangeContent event={event} />;
      case 'comment':
        return <CommentContent event={event} />;
      case 'rating':
        return <RatingContent event={event} />;
      default:
        return null;
    }
  };

  const shouldShowBorder = event.event_type !== 'comment';

  return (
    <div className={`shadow rounded-lg p-4 ${getBackgroundColor()} ${shouldShowBorder ? `border-l-4 ${getBorderColor()}` : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900">
          {getDisplayName(event)}
        </span>
        <span className="text-sm text-gray-500" title={new Date(event.created_at).toLocaleString()}>
          {formatCommentDate(event.created_at)}
        </span>
      </div>
      {renderEventContent()}
    </div>
  );
} 