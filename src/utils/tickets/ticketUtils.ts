import { Ticket } from '@/types/tickets';

export function getStatusColor(status: Ticket['status']): string {
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
}

export function formatTicketDate(date: string): string {
  return new Date(date).toLocaleDateString();
}

export function isTicketEditable(ticket: Ticket, userId: string, role: string): boolean {
  if (role === 'admin') return true;
  return ticket.created_by === userId;
} 