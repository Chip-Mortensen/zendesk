'use client';

import { useEffect } from 'react';
import { ChatEventWithUser } from '@/types/chat';
import { subscriptionHelpers } from '@/utils/sql/chatQueries';

type TimelineUpdater = (events: ChatEventWithUser[]) => ChatEventWithUser[];

export function useChatTimelineSubscription(
  conversationId: string,
  onUpdate: (updater: TimelineUpdater) => void
) {
  useEffect(() => {
    if (!conversationId) return;

    const subscription = subscriptionHelpers.subscribeToChatEvents(
      conversationId,
      payload => {
        if (payload.eventType === 'INSERT') {
          onUpdate(current => [...current, payload.new as ChatEventWithUser]);
        } else if (payload.eventType === 'DELETE') {
          onUpdate(current => current.filter(evt => evt.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          onUpdate(current =>
            current.map(evt => (evt.id === payload.new.id ? { ...evt, ...payload.new } : evt))
          );
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId, onUpdate]);
} 