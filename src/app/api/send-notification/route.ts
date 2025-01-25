import { NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export async function POST(request: Request) {
  console.log('📨 Send notification route called');
  try {
    const body = await request.json();
    console.log('📝 Request body:', body);
    
    const { userId, ticketId, eventId } = body;
    console.log('🔍 Extracted values:', { userId, ticketId, eventId });
    
    const supabase = createRouteHandlerClient({ cookies });
    console.log('🔌 Supabase client initialized');

    // Get user, ticket, and event details
    console.log('🔄 Fetching user data...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('❌ Error fetching user:', userError);
      throw userError;
    }
    console.log('✅ User data fetched:', userData);

    console.log('🔄 Fetching ticket data...');
    const { data: ticketData, error: ticketError } = await supabase
      .from('tickets')
      .select('title, description, org_slug')
      .eq('id', ticketId)
      .single();

    if (ticketError) {
      console.error('❌ Error fetching ticket:', ticketError);
      throw ticketError;
    }
    console.log('✅ Ticket data fetched:', ticketData);

    console.log('🔄 Fetching event data...');
    const { data: eventData, error: eventError } = await supabase
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

    if (eventError) {
      console.error('❌ Error fetching event:', eventError);
      throw eventError;
    }
    console.log('✅ Event data fetched:', eventData);

    if (!userData || !ticketData || !eventData) {
      console.error('❌ Missing required data:', {
        hasUserData: !!userData,
        hasTicketData: !!ticketData,
        hasEventData: !!eventData
      });
      throw new Error('Required data not found');
    }

    // Construct email content based on event type
    console.log('📧 Constructing email for event type:', eventData.event_type);
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
            <p><a href="${process.env.DEPLOYED_URL}/org/${ticketData.org_slug}/tickets/${ticketId}">View Ticket</a></p>
          </div>
        `;
        break;

      case 'status_change':
        html = `
          <div>
            <h2>Status Update for Ticket: ${ticketData.title}</h2>
            <p>${eventData.users.name} has updated the status of your ticket:</p>
            <p>Status changed from <strong>${eventData.old_status}</strong> to <strong>${eventData.new_status}</strong></p>
            <p><a href="${process.env.DEPLOYED_URL}/org/${ticketData.org_slug}/tickets/${ticketId}">View Ticket</a></p>
          </div>
        `;
        break;

      case 'assignment_change':
        console.log('🔄 Fetching new assignee data...');
        const { data: newAssignee, error: assigneeError } = await supabase
          .from('users')
          .select('name')
          .eq('id', eventData.new_assignee)
          .single();

        if (assigneeError) {
          console.error('❌ Error fetching new assignee:', assigneeError);
          throw assigneeError;
        }
        console.log('✅ New assignee data fetched:', newAssignee);

        html = `
          <div>
            <h2>Assignment Update for Ticket: ${ticketData.title}</h2>
            <p>Your ticket has been assigned to ${newAssignee?.name || 'a new agent'}</p>
            <p><a href="${process.env.DEPLOYED_URL}/org/${ticketData.org_slug}/tickets/${ticketId}">View Ticket</a></p>
          </div>
        `;
        break;

      default:
        console.error('❌ Unsupported event type:', eventData.event_type);
        throw new Error(`Unsupported event type: ${eventData.event_type}`);
    }

    const msg = {
      to: userData.email,
      from: process.env.SENDGRID_FROM_EMAIL || '',
      subject,
      html
    };

    console.log('📤 Sending email via SendGrid...', {
      to: userData.email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject
    });

    await sgMail.send(msg);
    console.log('✅ Email sent successfully');

    // Update notification queue status
    console.log('🔄 Updating notification queue status...');
    const { error: updateError } = await supabase
      .from('notification_queue')
      .update({ 
        status: 'sent',
        processed_at: new Date().toISOString()
      })
      .eq('event_id', eventId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error updating notification queue:', updateError);
      throw updateError;
    }
    console.log('✅ Notification queue updated successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send notification'
      },
      { status: 500 }
    );
  }
} 