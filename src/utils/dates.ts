export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(new Date(dateString));
}

export function formatStatus(status: string): string {
  return status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
} 