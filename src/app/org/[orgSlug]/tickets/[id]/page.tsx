'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ticketQueries, eventQueries, subscriptionHelpers } from '@/utils/sql/ticketQueries';
import { Ticket, TicketEventWithUser } from '@/types/tickets';
import { supabase } from '@/utils/supabase';
import TicketDetailContent from './TicketDetailContent';
import { useTicketTimelineSubscription } from '@/hooks/tickets/useTicketTimelineSubscription';

export default function OrgTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<TicketEventWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Check authentication
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Session error:', sessionError);
          router.push('/auth');
          return;
        }
        if (!session) {
          console.log('No session found, redirecting to auth');
          router.push('/auth');
          return;
        }

        const ticketId = params.id as string;
        const orgSlug = params.orgSlug as string;
        
        console.log('Fetching ticket:', ticketId, 'for org slug:', orgSlug);

        // First get the organization ID from the slug
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id')
          .eq('slug', orgSlug)
          .single();

        if (orgError) {
          console.error('Organization fetch error:', orgError);
          router.push('/auth');
          return;
        }

        if (!orgData) {
          console.error('Organization not found');
          router.push('/auth');
          return;
        }

        // Then verify user belongs to the organization
        const { data: memberData, error: memberError } = await supabase
          .from('org_members')
          .select('role, organization_id')
          .eq('user_id', session.user.id)
          .eq('organization_id', orgData.id)
          .single();

        console.log('Member data:', memberData, 'Member error:', memberError);

        if (memberError) {
          console.error('Member fetch error:', memberError);
          router.push('/auth');
          return;
        }

        // Finally fetch the ticket
        const { data: ticketData, error: ticketError } = await ticketQueries.getTicketById(ticketId, orgData.id);
        if (ticketError || !ticketData) {
          throw new Error(ticketError?.message || 'Error fetching ticket');
        }
        setTicket(ticketData);

        // Fetch timeline events
        const { data: eventsData, error: eventsError } = await eventQueries.getTicketEvents(ticketId);
        console.log('Timeline events:', eventsData, 'Events error:', eventsError);
        
        if (eventsError) {
          throw new Error(eventsError.message);
        }
        setEvents(eventsData || []);
      } catch (error) {
        console.error('Error in loadData:', error);
        router.push(`/org/${params.orgSlug}/tickets`);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [params.id, params.orgSlug, router]);

  // Subscribe to ticket changes
  useEffect(() => {
    if (!ticket?.id) return;

    const subscription = subscriptionHelpers.subscribeToTicket(
      ticket.id,
      (payload) => {
        if (payload.eventType === 'DELETE') {
          router.push(`/org/${params.orgSlug}/tickets`);
          return;
        }
        setTicket(payload.new as Ticket);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [ticket?.id, params.orgSlug, router]);

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
      onEventsUpdate={setEvents}
    />
  );
} 