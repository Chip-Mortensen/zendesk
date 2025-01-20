export type Ticket = {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  created_by: string;
  assigned_to?: string;
  org_slug: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
};

// Base event type
interface BaseTicketEvent {
  id: string;
  ticket_id: string;
  event_type: 'comment' | 'status_change' | 'priority_change' | 'note' | 'assignment_change';
  created_at: string;
  created_by: string;
}

// Comment event
export interface TicketCommentEvent extends BaseTicketEvent {
  event_type: 'comment';
  comment_text: string;
}

// Status change event
export interface TicketStatusChangeEvent extends BaseTicketEvent {
  event_type: 'status_change';
  old_status: Ticket['status'];
  new_status: Ticket['status'];
}

// Priority change event
export interface TicketPriorityChangeEvent extends BaseTicketEvent {
  event_type: 'priority_change';
  old_priority: Ticket['priority'];
  new_priority: Ticket['priority'];
}

// Assignment change event
export interface TicketAssignmentChangeEvent extends BaseTicketEvent {
  event_type: 'assignment_change';
  old_assignee: string | null;
  new_assignee: string;
}

// Note event
export interface TicketNoteEvent extends BaseTicketEvent {
  event_type: 'note';
  comment_text: string;
}

// Union type for all event types
export type TicketEvent = TicketCommentEvent | TicketStatusChangeEvent | TicketPriorityChangeEvent | TicketNoteEvent | TicketAssignmentChangeEvent;

// Event with user info
export type TicketEventWithUser = TicketEvent & {
  users: {
    name: string;
    email: string;
  }
};

export interface Comment {
  id: string;
  ticket_id: string;
  comment_text: string;
  created_at: string;
  created_by: string;
  commenter_name: string;
} 