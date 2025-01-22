export type Conversation = {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'closed';
  created_by: string;
  assigned_to: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
  assignee?: {
    name: string;
  } | null;
};

// Base event type
interface BaseChatEvent {
  id: string;
  conversation_id: string;
  event_type: 'message' | 'status_change' | 'assignment_change';
  created_at: string;
  created_by: string;
}

// Message event
export interface ChatMessageEvent extends BaseChatEvent {
  event_type: 'message';
  message_text: string;
}

// Status change event
export interface ChatStatusChangeEvent extends BaseChatEvent {
  event_type: 'status_change';
  old_status: Conversation['status'];
  new_status: Conversation['status'];
}

// Assignment change event
export interface ChatAssignmentChangeEvent extends BaseChatEvent {
  event_type: 'assignment_change';
  old_assignee: string | null;
  new_assignee: string;
}

// Union type for all event types
export type ChatEvent = ChatMessageEvent | ChatStatusChangeEvent | ChatAssignmentChangeEvent;

// Event with user info
export type ChatEventWithUser = ChatEvent & {
  users: {
    name: string;
    email: string;
  }
}; 