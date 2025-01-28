type SortDirection = 'asc' | 'desc';

const STATUS_ORDER = {
  open: 1,
  in_progress: 2,
  closed: 3,
} as const;

const PRIORITY_ORDER = {
  high: 1,
  medium: 2,
  low: 3,
} as const;

export interface SortableTicket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  organization_id: string;
  tag_id?: string;
  assigned_to?: string | null;
  assignee?: {
    name: string;
  } | null;
  customer?: {
    name: string;
  } | null;
  rating?: number;
  rating_comment?: string;
  rating_submitted_at?: string;
}

type SortableField = keyof SortableTicket | 'created_by' | 'assignee';

export function sortTickets(
  tickets: SortableTicket[],
  field: string,
  direction: SortDirection
): SortableTicket[] {
  const sortedTickets = [...tickets].sort((a, b) => {
    const sortField = field as SortableField;
    
    switch (sortField) {
      case 'title':
        return direction === 'asc'
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);

      case 'status':
        return direction === 'asc'
          ? STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
          : STATUS_ORDER[b.status] - STATUS_ORDER[a.status];

      case 'priority':
        return direction === 'asc'
          ? PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
          : PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];

      case 'created_at':
        return direction === 'asc'
          ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

      case 'tag_id':
        if (!a.tag_id && !b.tag_id) return 0;
        if (!a.tag_id) return direction === 'asc' ? -1 : 1;
        if (!b.tag_id) return direction === 'asc' ? 1 : -1;
        return direction === 'asc'
          ? a.tag_id.localeCompare(b.tag_id)
          : b.tag_id.localeCompare(a.tag_id);

      case 'assignee':
      case 'assigned_to':
        const aName = a.assignee?.name || '';
        const bName = b.assignee?.name || '';
        return direction === 'asc'
          ? aName.localeCompare(bName)
          : bName.localeCompare(aName);

      case 'created_by':
        const aCustomer = a.customer?.name || '';
        const bCustomer = b.customer?.name || '';
        return direction === 'asc'
          ? aCustomer.localeCompare(bCustomer)
          : bCustomer.localeCompare(aCustomer);

      case 'rating':
        const aRating = a.rating || 0;
        const bRating = b.rating || 0;
        return direction === 'asc'
          ? aRating - bRating
          : bRating - aRating;

      default:
        return 0;
    }
  });

  return sortedTickets;
} 