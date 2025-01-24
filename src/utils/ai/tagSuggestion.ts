export async function suggestAndUpdateTicketTag(
  ticketId: string,
  title: string,
  description: string,
  organizationId: string
) {
  try {
    const response = await fetch('/api/tickets/suggest-tag', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticketId,
        title,
        description,
        organizationId
      })
    });

    if (!response.ok) {
      console.error('Client: API request failed with status:', response.status);
      throw new Error('Failed to suggest tag');
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to suggest tag');
    }
  } catch (error) {
    console.error('Client: Error suggesting tag:', error);
  }
} 