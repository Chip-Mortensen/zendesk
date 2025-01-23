'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ticketQueries, eventQueries, subscriptionHelpers } from '@/utils/sql/ticketQueries';
import { Ticket, TicketEventWithUser } from '@/types/tickets';
import { supabase } from '@/utils/supabase';
import TicketDetailContent from './TicketDetailContent';

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<TicketEventWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth?type=admin');
        return;
      }

      try {
        const ticketId = params.id as string;
        
        // Fetch ticket data
        const { data: ticketData, error: ticketError } = await ticketQueries.getTicketById(ticketId);
        if (ticketError || !ticketData) {
          throw new Error(ticketError?.message || 'Error fetching ticket');
        }
        if (isMounted) setTicket(ticketData);

        // Fetch timeline events
        const { data: eventsData, error: eventsError } = await eventQueries.getTicketEvents(ticketId);
        if (eventsError) {
          throw new Error(eventsError.message);
        }
        if (isMounted) setEvents(eventsData || []);
      } catch (error) {
        console.error('Error loading ticket details:', error);
        if (isMounted) {
          setError(error instanceof Error ? error.message : 'An error occurred');
        }
        router.push('/dashboard/tickets');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [params.id, router]);

  // Subscribe to ticket changes
  useEffect(() => {
    if (!ticket?.id) return;

    console.log('Setting up ticket subscription for:', ticket.id);
    const subscription = subscriptionHelpers.subscribeToTicket(
      ticket.id,
      (payload) => {
        console.log('Received ticket update:', payload);
        if (payload.eventType === 'DELETE') {
          router.push('/dashboard/tickets');
          return;
        }
        setTicket(payload.new as Ticket);
      }
    );

    return () => {
      console.log('Cleaning up ticket subscription for:', ticket.id);
      subscription.unsubscribe();
    };
  }, [ticket?.id, router]);

  // Subscribe to timeline events with retry logic
  useEffect(() => {
    if (!ticket?.id) return;

    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeout: NodeJS.Timeout;

    const setupSubscription = () => {
      console.log('Setting up timeline subscription for:', ticket.id, 'attempt:', retryCount + 1);
      
      try {
        const subscription = subscriptionHelpers.subscribeToEvents(
          ticket.id,
          async (payload) => {
            console.log('Received timeline event:', payload);
            
            try {
              if (payload.eventType === 'INSERT') {
                setEvents(currentEvents => {
                  console.log('Adding new event to timeline');
                  return [...currentEvents, payload.new as TicketEventWithUser];
                });
              } else if (payload.eventType === 'DELETE') {
                setEvents(currentEvents => {
                  console.log('Removing event from timeline');
                  return currentEvents.filter(event => event.id !== payload.old.id);
                });
              } else if (payload.eventType === 'UPDATE') {
                setEvents(currentEvents => {
                  console.log('Updating event in timeline');
                  return currentEvents.map(event =>
                    event.id === payload.new.id ? { ...event, ...payload.new as TicketEventWithUser } : event
                  );
                });
              }
            } catch (error) {
              console.error('Error processing timeline event:', error);
              if (retryCount < maxRetries) {
                retryCount++;
                retryTimeout = setTimeout(setupSubscription, 1000 * retryCount);
              }
            }
          }
        );

        return () => {
          console.log('Cleaning up timeline subscription for:', ticket.id);
          clearTimeout(retryTimeout);
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error setting up timeline subscription:', error);
        if (retryCount < maxRetries) {
          retryCount++;
          retryTimeout = setTimeout(setupSubscription, 1000 * retryCount);
        }
        return () => clearTimeout(retryTimeout);
      }
    };

    return setupSubscription();
  }, [ticket?.id]);

  if (loading) {
    return <div className="p-4">Loading ticket details...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  if (!ticket) {
    return null;
  }

  return (
    <TicketDetailContent
      ticket={ticket}
      events={events}
      onEventsUpdate={setEvents}
    />
  );
} 