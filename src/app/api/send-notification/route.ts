import { NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function POST(req: Request) {
  console.log('🔄 Processing notification request');
  const supabaseAdmin = createRouteHandlerClient({ cookies }, { 
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  try {
    const { ticketId, userId, eventId } = await req.json();
    console.log('📝 Request data:', { ticketId, userId, eventId });

    // Get user data using the same pattern as in ticketQueries
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        name,
        email
      `)
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('❌ Error fetching user:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get ticket data with organization info using the same pattern as in ticketQueries
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select(`
        *,
        organization:organization_id (
          slug
        )
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('❌ Error fetching ticket:', ticketError);
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Get event data
    const { data: event, error: eventError } = await supabaseAdmin
      .from('ticket_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      console.error('❌ Error fetching event:', eventError);
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Construct email content based on event type
    let subject = '';
    let text = '';

    switch (event.event_type) {
      case 'comment':
        subject = `New comment on ticket: ${ticket.title}`;
        text = `A new comment has been added to your ticket:\n\n${event.comment_text}`;
        break;
      case 'status_change':
        subject = `Status update on ticket: ${ticket.title}`;
        text = `The status of your ticket has been changed from ${event.old_status} to ${event.new_status}`;
        break;
      case 'assignment_change':
        subject = `Assignment update on ticket: ${ticket.title}`;
        text = `Your ticket has been assigned to a new team member`;
        break;
      default:
        console.log('⚠️ Unsupported event type:', event.event_type);
        return NextResponse.json({ error: 'Unsupported event type' }, { status: 400 });
    }

    // Send email
    const msg = {
      to: userData.email,
      from: 'support@chipmortensen.com',
      subject,
      text,
      html: text.replace(/\n/g, '<br>'),
    };

    console.log('📧 Sending email:', msg);
    await sgMail.send(msg);

    // Update notification queue status
    const { error: updateError } = await supabaseAdmin
      .from('notification_queue')
      .update({ status: 'sent' })
      .eq('event_id', eventId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error updating notification status:', updateError);
      return NextResponse.json({ error: 'Failed to update notification status' }, { status: 500 });
    }

    console.log('✅ Notification sent successfully');
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Error processing notification:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 