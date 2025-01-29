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
  // Convert URLs to links but preserve the rest of the text
  const renderTextWithLinks = (text: string) => {
    // Regex for URLs (including our KB article URLs)
    const urlRegex = /(https?:\/\/[^\s]+)/g
    
    // Split text by URLs and map each part
    const parts = text.split(urlRegex)
    const matches = text.match(urlRegex) || []
    
    return parts.map((part, i) => {
      // Regular text
      if (i % 2 === 0) return part
      
      // URL part - matches[Math.floor(i/2)] will get the corresponding URL
      const url = matches[Math.floor(i/2)]
      return (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          {url}
        </a>
      )
    })
  }

  return (
    <div className="space-y-2">
      {event.is_ai_response && (
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-full border border-blue-100">
            AI Response
          </span>
        </div>
      )}
      <p className="text-sm text-gray-700 whitespace-pre-wrap">
        {renderTextWithLinks(event.comment_text || '')}
      </p>
    </div>
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
      {event.old_tag ? (
        <>Changed tag from &ldquo;{event.old_tag}&rdquo; to &ldquo;{event.new_tag}&rdquo;</>
      ) : (
        <>Added tag &ldquo;{event.new_tag}&rdquo;</>
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
  const [orgName, setOrgName] = useState<string>('');

  useEffect(() => {
    async function fetchOrgName() {
      if (event.is_ai_response && !event.organization?.name) {
        const { data: ticket } = await supabase
          .from('tickets')
          .select(`
            organization_id,
            organizations (
              name
            )
          `)
          .eq('id', event.ticket_id)
          .single();
        
        if (ticket?.organizations && 
            typeof ticket.organizations === 'object' && 
            'name' in ticket.organizations && 
            typeof ticket.organizations.name === 'string') {
          setOrgName(ticket.organizations.name);
        }
      }
    }
    fetchOrgName();
  }, [event.is_ai_response, event.ticket_id, event.organization?.name]);

  const getDisplayName = (event: TicketEventWithUser): string => {
    if (event.is_ai_response) {
      const name = event.organization?.name || orgName;
      return name ? `${name} Agent` : 'AI Agent';
    }
    return event.users?.name || 'Unknown User';
  };

  const getBorderColor = () => {
    switch (event.event_type) {
      case 'status_change':
        return 'border-blue-500';
      case 'priority_change':
        return 'border-yellow-500';
      case 'assignment_change':
        return 'border-purple-500';
      case 'note':
        return event.is_ai_response ? 'border-blue-500' : 'border-gray-500';
      case 'tag_change':
        return 'border-blue-500';
      case 'rating':
        return 'border-yellow-400';
      case 'comment':
        return event.is_ai_response ? 'border-blue-500' : '';
      default:
        return '';
    }
  };

  const getBackgroundColor = () => {
    if (event.event_type === 'note' && !event.is_ai_response) return 'bg-gray-50';
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