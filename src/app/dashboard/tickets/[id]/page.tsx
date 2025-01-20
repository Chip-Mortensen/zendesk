'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ticketQueries, eventQueries, subscriptionHelpers } from '@/utils/sql/ticketQueries';
import { Ticket, TicketEventWithUser } from '@/types/tickets';
import { supabase } from '@/utils/supabase';
import TicketDetailContent from './TicketDetailContent';
import { useTicketTimelineSubscription } from '@/hooks/tickets/useTicketTimelineSubscription';

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<TicketEventWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        setTicket(ticketData);

        // Fetch timeline events
        const { data: eventsData, error: eventsError } = await eventQueries.getTicketEvents(ticketId);
        if (eventsError) {
          throw new Error(eventsError.message);
        }
        setEvents(eventsData || []);
      } catch (error) {
        console.error('Error loading ticket details:', error);
        router.push('/dashboard/tickets');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [params.id, router]);

  // Subscribe to ticket changes
  useEffect(() => {
    if (!ticket?.id) return;

    const subscription = subscriptionHelpers.subscribeToTicket(
      ticket.id,
      (payload) => {
        if (payload.eventType === 'DELETE') {
          router.push('/dashboard/tickets');
          return;
        }
        setTicket(payload.new as Ticket);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [ticket?.id, router]);

  // Subscribe to timeline events
  useTicketTimelineSubscription(ticket?.id || '', setEvents);

  if (loading) {
    return <div className="p-4">Loading ticket details...</div>;
  }

  if (!ticket) {
    return null;
  }

  return (
    <TicketDetailContent
      ticket={ticket}
      events={events}
    />
  );
} 