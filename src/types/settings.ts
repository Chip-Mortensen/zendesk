export interface UserTicketFilters {
  status: string[];
  priority: string[];
  assignee: string[];
  customer: string[];
  tag: string[];
  created: string[];
}

export interface UserSettings {
  ticket_filters?: UserTicketFilters;
  // Add more settings here as needed
} 