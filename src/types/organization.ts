export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings?: {
    theme?: string;
    notifications?: {
      email?: boolean;
      slack?: boolean;
    };
    customFields?: Record<string, string | number | boolean>;
  };
  created_at?: string;
  updated_at?: string;
} 