'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import type { Organization } from '@/types/organization';

interface UseOrganizationReturn {
  organization: Organization | null;
  loading: boolean;
  error: Error | null;
}

export function useOrganization(): UseOrganizationReturn {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchOrganization() {
      try {
        setLoading(true);
        setError(null);

        // For now, we'll just fetch the first organization
        // In a real app, you might get this from user session or context
        const { data, error: fetchError } = await supabase
          .from('organizations')
          .select('*')
          .limit(1)
          .single();

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        setOrganization(data);
      } catch (err) {
        console.error('Error fetching organization:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch organization'));
      } finally {
        setLoading(false);
      }
    }

    fetchOrganization();
  }, []);

  return { organization, loading, error };
} 