interface SendInviteEmailParams {
  to: string;
  organizationName: string;
  inviteUrl: string;
}

export async function sendTeamInviteEmail({ to, organizationName, inviteUrl }: SendInviteEmailParams) {
  try {
    const response = await fetch('/api/send-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        organizationName,
        inviteUrl
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `API error: ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send invite email' 
    };
  }
} 