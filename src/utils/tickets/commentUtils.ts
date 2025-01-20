import { Comment } from '@/types/tickets';

export function formatCommentDate(date: string): string {
  return new Date(date).toLocaleDateString();
}

export function canDeleteComment(comment: Comment, userId: string, role: string): boolean {
  if (role === 'admin') return true;
  return comment.created_by === userId;
} 