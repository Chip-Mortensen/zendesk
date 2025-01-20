import { Comment } from '@/types/tickets';

export function formatCommentDate(date: string): string {
  const commentDate = new Date(date);
  return commentDate.toLocaleDateString() + ' ' + commentDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function canDeleteComment(comment: Comment, userId: string, role: string): boolean {
  if (role === 'admin') return true;
  return comment.created_by === userId;
} 