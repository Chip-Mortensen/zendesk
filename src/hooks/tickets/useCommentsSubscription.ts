import { useEffect } from 'react';
import { Comment } from '@/types/tickets';
import { supabase } from '@/utils/supabase';

type CommentsUpdater = (comments: Comment[]) => Comment[];

export function useCommentsSubscription(
  ticketId: string,
  onUpdate: (updater: CommentsUpdater) => void
) {
  useEffect(() => {
    const channel = supabase.channel(`ticket-comments-${ticketId}`);
    
    const subscription = channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_comments',
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          console.log('Comment update:', payload);
          if (payload.eventType === 'INSERT') {
            onUpdate((currentComments: Comment[]) => [...currentComments, payload.new as Comment]);
          } else if (payload.eventType === 'DELETE') {
            onUpdate((currentComments: Comment[]) => 
              currentComments.filter(comment => comment.id !== payload.old.id)
            );
          } else if (payload.eventType === 'UPDATE') {
            onUpdate((currentComments: Comment[]) =>
              currentComments.map(comment =>
                comment.id === payload.new.id ? { ...comment, ...payload.new as Comment } : comment
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [ticketId, onUpdate]);
} 