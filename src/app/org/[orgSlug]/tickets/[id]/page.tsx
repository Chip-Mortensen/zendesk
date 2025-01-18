'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  organization_id: string;
  created_by: string;
}

interface Comment {
  id: string;
  ticket_id: string;
  comment_text: string;
  created_at: string;
  created_by: string;
}

export default function CustomerTicketDetail({ params }: { params: { orgSlug: string; id: string } }) {
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    async function loadUserAndTicket() {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // Get user's organization
        const { data: memberData } = await supabase
          .from('member_details')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('organization_slug', params.orgSlug)
          .single();

        if (memberData?.organization_id) {
          setOrganizationId(memberData.organization_id);
          await fetchTicketAndComments(memberData.organization_id, user.id);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    }

    loadUserAndTicket();
  }, [params.id, params.orgSlug, router]);

  async function fetchTicketAndComments(orgId: string, userId: string) {
    try {
      // Fetch ticket details
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', params.id)
        .eq('organization_id', orgId)
        .eq('created_by', userId)  // Only allow viewing own tickets
        .single();

      if (ticketError) throw ticketError;
      setTicket(ticketData);

      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('ticket_comments')
        .select('*')
        .eq('ticket_id', params.id)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;
      setComments(commentsData || []);
    } catch (error) {
      console.error('Error fetching ticket:', error);
      router.push(`/org/${params.orgSlug}/tickets`); // Redirect if ticket not found or not accessible
    } finally {
      setLoading(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || !organizationId) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('ticket_comments')
        .insert([
          {
            ticket_id: params.id,
            comment_text: newComment.trim(),
            created_by: user.id,
          },
        ]);

      if (error) throw error;
      setNewComment('');
      await fetchTicketAndComments(organizationId, user.id);
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading ticket details...</div>;
  }

  if (!ticket) {
    return <div className="text-center py-12">Ticket not found</div>;
  }

  const getStatusColor = (status: Ticket['status']) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'closed':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.push(`/org/${params.orgSlug}/tickets`)}
          className="text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
        >
          ← Back to tickets
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">{ticket.title}</h1>
        <div className="mt-2 flex items-center space-x-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
            {ticket.status.replace('_', ' ')}
          </span>
          <span className="text-sm text-gray-500">
            Created on {new Date(ticket.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Comments</h2>
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-white shadow rounded-lg p-4">
              <p className="text-gray-700">{comment.comment_text}</p>
              <p className="text-sm text-gray-500 mt-2">
                {new Date(comment.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddComment} className="mt-6">
          <div>
            <label htmlFor="comment" className="sr-only">
              Add a comment
            </label>
            <textarea
              id="comment"
              rows={3}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Adding...' : 'Add Comment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 