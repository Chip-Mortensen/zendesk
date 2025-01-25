import { NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export async function POST(request: Request) {
  try {
    const { userId, ticketId, eventId } = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    // Get user, ticket, and event details
    const { data: userData } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', userId)
      .single();

    const { data: ticketData } = await supabase
      .from('tickets')
      .select('title, description, org_slug')
      .eq('id', ticketId)
      .single();

    const { data: eventData } = await supabase
      .from('ticket_events')
      .select(`
        *,
        users!inner (
          name,
          email
        )
      `)
      .eq('id', eventId)
      .single();

    if (!userData || !ticketData || !eventData) {
      throw new Error('Required data not found');
    }

    // Construct email content based on event type
    const subject = `[Ticket Update] ${ticketData.title}`;
    let html = '';

    switch (eventData.event_type) {
      case 'comment':
        html = `
          <div>
            <h2>New Comment on Ticket: ${ticketData.title}</h2>
            <p>A new comment has been added to your ticket by ${eventData.users.name}:</p>
            <blockquote style="border-left: 4px solid #e5e7eb; padding-left: 1rem; margin: 1rem 0;">
              ${eventData.comment_text}
            </blockquote>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/org/${ticketData.org_slug}/tickets/${ticketId}">View Ticket</a></p>
          </div>
        `;
        break;

      case 'status_change':
        html = `
          <div>
            <h2>Status Update for Ticket: ${ticketData.title}</h2>
            <p>${eventData.users.name} has updated the status of your ticket:</p>
            <p>Status changed from <strong>${eventData.old_status}</strong> to <strong>${eventData.new_status}</strong></p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/org/${ticketData.org_slug}/tickets/${ticketId}">View Ticket</a></p>
          </div>
        `;
        break;

      case 'assignment_change':
        const { data: newAssignee } = await supabase
          .from('users')
          .select('name')
          .eq('id', eventData.new_assignee)
          .single();

        html = `
          <div>
            <h2>Assignment Update for Ticket: ${ticketData.title}</h2>
            <p>Your ticket has been assigned to ${newAssignee?.name || 'a new agent'}</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/org/${ticketData.org_slug}/tickets/${ticketId}">View Ticket</a></p>
          </div>
        `;
        break;

      default:
        throw new Error(`Unsupported event type: ${eventData.event_type}`);
    }

    const msg = {
      to: userData.email,
      from: process.env.SENDGRID_FROM_EMAIL || '',
      subject,
      html
    };

    await sgMail.send(msg);

    // Update notification queue status
    await supabase
      .from('notification_queue')
      .update({ 
        status: 'sent',
        processed_at: new Date().toISOString()
      })
      .eq('event_id', eventId)
      .eq('user_id', userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send notification'
      },
      { status: 500 }
    );
  }
} 