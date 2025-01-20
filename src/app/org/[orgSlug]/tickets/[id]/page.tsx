'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ticketQueries, commentQueries, subscriptionHelpers } from '@/utils/sql/ticketQueries';
import { Ticket, TicketCommentWithUser } from '@/types/tickets';
import { supabase } from '@/utils/supabase';
import TicketDetailContent from './TicketDetailContent';

export default function OrgTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketCommentWithUser[]>([]);
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
          .select('role')
          .eq('user_id', session.user.id)
          .eq('organization_id', orgData.id)
          .single();

        if (memberError) {
          console.error('Member verification error:', memberError);
          router.push('/auth');
          return;
        }

        if (!memberData) {
          console.error('User is not a member of this organization');
          router.push('/auth');
          return;
        }
        
        // Fetch ticket data with org verification
        const { data: ticketData, error: ticketError } = await ticketQueries.getTicketById(ticketId, orgData.id);
        
        if (ticketError) {
          console.error('Ticket fetch error:', ticketError);
          throw new Error(ticketError.message || 'Error fetching ticket');
        }
        
        if (!ticketData) {
          console.log('No ticket found');
          throw new Error('Ticket not found');
        }

        // Verify user has access to the ticket
        if (ticketData.created_by !== session.user.id && memberData.role !== 'admin') {
          console.error('User does not have access to this ticket');
          throw new Error('Access denied');
        }

        console.log('Ticket loaded successfully');
        setTicket(ticketData);

        // Fetch comments
        const { data: commentsData, error: commentsError } = await commentQueries.getTicketComments(ticketId);
        if (commentsError) {
          console.error('Comments fetch error:', commentsError);
          throw new Error(commentsError.message);
        }
        setComments(commentsData || []);
      } catch (error) {
        console.error('Error in loadData:', error);
        router.push(`/org/${params.orgSlug}/tickets`);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [params.id, params.orgSlug, router]);

  useEffect(() => {
    if (!ticket?.id) return;

    // Subscribe to ticket changes
    const ticketSubscription = subscriptionHelpers.subscribeToTicket(
      ticket.id,
      (payload) => {
        if (payload.eventType === 'DELETE') {
          router.push(`/org/${params.orgSlug}/tickets`);
          return;
        }
        setTicket(payload.new as Ticket);
      }
    );

    // Subscribe to comment changes
    const commentSubscription = subscriptionHelpers.subscribeToComments(
      ticket.id,
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setComments(prev => [...prev, payload.new as TicketCommentWithUser]);
        } else if (payload.eventType === 'UPDATE') {
          setComments(prev => prev.map(comment => 
            comment.id === payload.new.id ? payload.new as TicketCommentWithUser : comment
          ));
        } else if (payload.eventType === 'DELETE') {
          setComments(prev => prev.filter(comment => comment.id !== payload.old.id));
        }
      }
    );

    return () => {
      ticketSubscription.unsubscribe();
      commentSubscription.unsubscribe();
    };
  }, [ticket?.id, params.orgSlug, router]);

  if (loading) {
    return <div className="p-4">Loading ticket details...</div>;
  }

  if (!ticket) {
    return <div className="p-4">Ticket not found</div>;
  }

  return <TicketDetailContent ticket={ticket} comments={comments} />;
} 