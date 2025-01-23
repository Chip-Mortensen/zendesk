'use client';

import { useState, useEffect } from 'react';
import { ChatEventWithUser, ChatMessageEvent, ChatStatusChangeEvent, ChatAssignmentChangeEvent } from '@/types/chat';
import { formatDate } from '@/utils/dates';
import { supabase } from '@/utils/supabase';

interface ConversationEventProps {
  event: ChatEventWithUser;
  currentUserId: string | null;
}

function formatStatus(status: string): string {
  return status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function ConversationEvent({ event, currentUserId }: ConversationEventProps) {
  const [assigneeName, setAssigneeName] = useState<string>('');
  const isCurrentUser = event.event_type === 'message' && currentUserId === event.created_by;

  useEffect(() => {
    if (event.event_type === 'assignment_change') {
      const assignEvent = event as ChatAssignmentChangeEvent;
      if (assignEvent.new_assignee) {
        supabase
          .from('users')
          .select('name')
          .eq('id', assignEvent.new_assignee)
          .single()
          .then(({ data }) => {
            if (data) {
              setAssigneeName(data.name);
            }
          });
      }
    }
  }, [event]);

  const isSystemEvent = event.event_type === 'status_change' || event.event_type === 'assignment_change';

  let content;
  switch (event.event_type) {
    case 'message':
      const messageEvent = event as ChatMessageEvent;
      content = (
        <div className={`flex flex-col w-fit max-w-[85%] ${isCurrentUser ? 'ml-auto items-end' : ''}`}>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-gray-400 text-xs">{formatDate(event.created_at)}</span>
          </div>
          <div
            className={`px-4 py-2 rounded-2xl ${
              isCurrentUser
                ? 'bg-blue-500 text-white rounded-tr-none'
                : 'bg-gray-200 text-gray-900 rounded-tl-none'
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{messageEvent.message_text}</p>
          </div>
        </div>
      );
      break;
    case 'status_change':
      const statusEvent = event as ChatStatusChangeEvent;
      content = (
        <div className="flex items-center justify-center">
          <div className="bg-gray-100 rounded-full px-4 py-1.5 text-sm text-gray-500 flex items-center space-x-1">
            {statusEvent.new_status === 'closed' ? (
              <>
                <span className="font-medium">{event.users.name}</span>
                <span>left the chat</span>
                <span>•</span>
                <span className="text-gray-400">{formatDate(event.created_at)}</span>
              </>
            ) : (
              <>
                <span>{event.users.name}</span>
                <span>•</span>
                <span>Changed status from <span className="font-medium">{formatStatus(statusEvent.old_status)}</span> to{' '}
                <span className="font-medium">{formatStatus(statusEvent.new_status)}</span></span>
                <span>•</span>
                <span className="text-gray-400">{formatDate(event.created_at)}</span>
              </>
            )}
          </div>
        </div>
      );
      break;
    case 'assignment_change':
      const assignEvent = event as ChatAssignmentChangeEvent;
      content = (
        <div className="flex items-center justify-center">
          <div className="bg-gray-100 rounded-full px-4 py-1.5 text-sm text-gray-500 flex items-center space-x-1">
            {currentUserId === event.created_by ? (
              // Admin view
              <>
                <span>{event.users.name}</span>
                <span>•</span>
                <span>
                  {assignEvent.old_assignee ? 'Reassigned' : 'Assigned'} to{' '}
                  <span className="font-medium">{assigneeName || 'Unassigned'}</span>
                </span>
                <span>•</span>
                <span className="text-gray-400">{formatDate(event.created_at)}</span>
              </>
            ) : (
              // Customer view
              <>
                <span className="font-medium">{assigneeName}</span>
                <span>has joined the chat</span>
                <span>•</span>
                <span className="text-gray-400">{formatDate(event.created_at)}</span>
              </>
            )}
          </div>
        </div>
      );
      break;
  }

  return (
    <div className={`py-1.5 ${isSystemEvent ? '' : 'px-4'}`}>
      {content}
    </div>
  );
} 