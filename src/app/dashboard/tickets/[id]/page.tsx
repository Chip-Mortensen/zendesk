'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ticketQueries, commentQueries, subscriptionHelpers } from '@/utils/sql/ticketQueries';
import { Ticket, TicketCommentWithUser } from '@/types/tickets';
import { supabase } from '@/utils/supabase';
import TicketDetailContent from './TicketDetailContent';

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketCommentWithUser[]>([]);
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

        // Fetch comments
        const { data: commentsData, error: commentsError } = await commentQueries.getTicketComments(ticketId);
        if (commentsError) {
          throw new Error(commentsError.message);
        }
        setComments(commentsData || []);
      } catch (error) {
        console.error('Error loading ticket details:', error);
        router.push('/dashboard/tickets');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [params.id, router]);

  useEffect(() => {
    if (!ticket?.id) return;

    // Subscribe to ticket changes
    const ticketSubscription = subscriptionHelpers.subscribeToTicket(
      ticket.id,
      (payload) => {
        if (payload.eventType === 'DELETE') {
          router.push('/dashboard/tickets');
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
  }, [ticket?.id, router]);

  if (loading) {
    return <div className="p-4">Loading ticket details...</div>;
  }

  if (!ticket) {
    return <div className="p-4">Ticket not found</div>;
  }

  return <TicketDetailContent ticket={ticket} comments={comments} />;
} 