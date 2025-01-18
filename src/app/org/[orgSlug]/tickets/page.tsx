'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { use } from 'react';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  organization_id: string;
  created_at: string;
}

export default function CustomerTicketsPage() {
  const params = useParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgSlug, setOrgSlug] = useState<string>('');

  // Set orgSlug once when component mounts
  useEffect(() => {
    const slug = params?.orgSlug;
    if (typeof slug === 'string') {
      setOrgSlug(slug);
    }
  }, [params?.orgSlug]);

  useEffect(() => {
    if (!orgSlug) return;

    async function loadUserAndTickets() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error('No session found');
          return;
        }

        // First get the organization ID from the slug
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id')
          .eq('slug', orgSlug)
          .single();

        if (orgError || !orgData) {
          console.error('Organization not found:', orgError);
          return;
        }

        // Then get tickets for this organization
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('tickets')
          .select('*')
          .eq('organization_id', orgData.id)
          .order('created_at', { ascending: false });

        if (ticketsError) {
          console.error('Error fetching tickets:', ticketsError);
          return;
        }

        setTickets(ticketsData || []);
      } catch (error) {
        console.error('Error in loadUserAndTickets:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUserAndTickets();
  }, [orgSlug]);

  if (loading) {
    return <div>Loading tickets...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">My Tickets</h1>
      {tickets.length === 0 ? (
        <p>No tickets found.</p>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="bg-white p-4 rounded-lg shadow">
              <h2 className="font-semibold">{ticket.title}</h2>
              <p className="text-gray-600">{ticket.description}</p>
              <div className="mt-2 text-sm text-gray-500">
                Status: {ticket.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 