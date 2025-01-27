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
    // Handle webhook payload
    const webhookPayload = await req.json();
    const event = webhookPayload.record;
    console.log('📝 Webhook payload:', event);

    // Get ticket data with organization info
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select(`
        *,
        organization:organization_id (
          slug
        )
      `)
      .eq('id', event.ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error('❌ Error fetching ticket:', ticketError);
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Check notification conditions
    if (!ticket.notifications_enabled ||
        !['comment', 'status_change', 'assignment_change'].includes(event.event_type) ||
        ticket.created_by === event.created_by) {
      console.log('⏭️ Skipping notification:', { 
        notifications_enabled: ticket.notifications_enabled,
        event_type: event.event_type,
        is_customer: ticket.created_by === event.created_by
      });
      return NextResponse.json({ 
        status: 'skipped',
        reason: 'Notification conditions not met'
      });
    }

    // Get customer data (ticket creator)
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        name,
        email
      `)
      .eq('id', ticket.created_by)
      .single();

    if (userError || !userData) {
      console.error('❌ Error fetching user:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Construct email content based on event type
    let subject = '';
    let text = '';

    switch (event.event_type) {
      case 'comment':
        subject = `[Ticket #${ticket.id}] ${ticket.title}`;
        text = `A new comment has been added to your ticket:\n\n${event.comment_text}`;
        break;
      case 'status_change':
        subject = `[Ticket #${ticket.id}] ${ticket.title}`;
        text = `The status of your ticket has been changed from ${event.old_status} to ${event.new_status}`;
        break;
      case 'assignment_change':
        subject = `[Ticket #${ticket.id}] ${ticket.title}`;
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
      replyTo: `ticket-${ticket.id}@parse.chipmortensen.com`,
      subject,
      text,
      html: text.replace(/\n/g, '<br>'),
    };

    console.log('📧 Sending email:', msg);
    await sgMail.send(msg);

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