export type Ticket = {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  created_by: string;
  assigned_to?: string;
  org_slug: string;
  created_at: string;
  updated_at: string;
};

export type TicketComment = {
  id: string;
  ticket_id: string;
  comment_text: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
};

export type TicketCommentWithUser = {
  id: string;
  ticket_id: string;
  comment_text: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  users: {
    name: string;
    email: string;
  } | null;
};

export interface Comment {
  id: string;
  ticket_id: string;
  comment_text: string;
  created_at: string;
  created_by: string;
  commenter_name: string;
} 