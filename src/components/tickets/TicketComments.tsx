'use client';

import { useState } from 'react';
import { TicketCommentWithUser } from '@/types/tickets';
import { formatCommentDate } from '@/utils/tickets/commentUtils';
import { commentQueries } from '@/utils/sql/ticketQueries';
import { supabase } from '@/utils/supabase';

interface TicketCommentsProps {
  comments: TicketCommentWithUser[];
  ticketId: string;
}

function getDisplayName(comment: TicketCommentWithUser): string {
  return comment.users?.name || 'Unknown User';
}

export default function TicketComments({ comments, ticketId }: TicketCommentsProps) {
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await commentQueries.createComment({
        ticket_id: ticketId,
        comment_text: newComment.trim(),
        created_by: user.id,
      });

      if (error) throw error;
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Comments</h2>
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">
                {getDisplayName(comment)}
              </span>
              <span className="text-sm text-gray-500" title={new Date(comment.created_at).toLocaleString()}>
                {formatCommentDate(comment.created_at)}
              </span>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap">{comment.comment_text}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleAddComment} className="mt-6">
        <div>
          <label htmlFor="comment" className="sr-only">
            Add comment
          </label>
          <textarea
            id="comment"
            name="comment"
            rows={3}
            className="shadow-sm block w-full focus:ring-blue-500 focus:border-blue-500 sm:text-sm border border-gray-300 rounded-md"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
        </div>
        <div className="mt-3">
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add Comment'}
          </button>
        </div>
      </form>
    </div>
  );
} 