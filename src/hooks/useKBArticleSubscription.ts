import { useEffect } from 'react';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { KBArticle } from '@/types/kb';
import { subscriptionHelpers } from '@/utils/sql/kbQueries';

export function useKBArticleSubscription(
  organizationId: string | null,
  callback: (payload: RealtimePostgresChangesPayload<KBArticle>) => void
) {
  useEffect(() => {
    if (!organizationId) return;

    const subscription = subscriptionHelpers.subscribeToKBArticles(organizationId, callback);

    return () => {
      subscription.unsubscribe();
    };
  }, [organizationId, callback]);
} 