export function formatChatTime(date: string | Date, prefix: string = 'Started'): string {
  const chatDate = new Date(date);
  const now = new Date();
  const diff = now.getTime() - chatDate.getTime();
  const isWithin24Hours = diff < 24 * 60 * 60 * 1000;
  
  if (isWithin24Hours) {
    return `${prefix} ${chatDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return `${prefix} ${chatDate.toLocaleDateString()}`;
} 