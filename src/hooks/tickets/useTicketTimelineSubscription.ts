'use client';

import { useEffect } from 'react';
import { TicketEventWithUser } from '@/types/tickets';
import { subscriptionHelpers } from '@/utils/sql/ticketQueries';

type TimelineUpdater = (events: TicketEventWithUser[]) => TicketEventWithUser[];

export function useTicketTimelineSubscription(
  ticketId: string,
  onUpdate: (updater: TimelineUpdater) => void
) {
  useEffect(() => {
    const subscription = subscriptionHelpers.subscribeToEvents(
      ticketId,
      (payload) => {
        console.log('Timeline event update:', payload);
        if (payload.eventType === 'INSERT') {
          onUpdate((currentEvents) => [...currentEvents, payload.new as TicketEventWithUser]);
        } else if (payload.eventType === 'DELETE') {
          onUpdate((currentEvents) => 
            currentEvents.filter(event => event.id !== payload.old.id)
          );
        } else if (payload.eventType === 'UPDATE') {
          onUpdate((currentEvents) =>
            currentEvents.map(event =>
              event.id === payload.new.id ? { ...event, ...payload.new as TicketEventWithUser } : event
            )
          );
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [ticketId, onUpdate]);
} 