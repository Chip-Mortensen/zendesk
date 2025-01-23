export interface UserTicketFilters {
  status: string[];
  priority: string[];
  assignee: string[];
  customer: string[];
  tag: string[];
  created: string[];
}

export interface UserConversationFilters {
  status: string[];
  assignee: string[];
  created: string[];
}

export interface UserSettings {
  ticket_filters?: UserTicketFilters;
  conversation_filters?: UserConversationFilters;
  // Add more settings here as needed
} 