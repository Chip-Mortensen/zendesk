import { useEffect } from 'react';
import { Ticket } from '@/types/tickets';
import { supabase } from '@/utils/supabase';

export function useTicketSubscription(
  ticketId: string,
  onUpdate: (ticket: Ticket) => void,
  onDelete?: () => void
) {
  useEffect(() => {
    const channel = supabase.channel(`ticket-details-${ticketId}`);
    
    const subscription = channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${ticketId}`,
        },
        (payload) => {
          console.log('Ticket update:', payload);
          if (payload.eventType === 'UPDATE') {
            onUpdate(payload.new as Ticket);
          } else if (payload.eventType === 'DELETE' && onDelete) {
            onDelete();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [ticketId, onUpdate, onDelete]);
} 