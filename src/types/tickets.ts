export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  organization_id: string;
  created_by: string;
}

export interface Comment {
  id: string;
  ticket_id: string;
  comment_text: string;
  created_at: string;
  created_by: string;
  commenter_name: string;
} 