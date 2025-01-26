import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

interface FormDataObject {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  envelope?: string;
  attachments?: string;
  headers?: string;
  [key: string]: string | undefined;
}

export async function POST(request: Request) {
  try {
    // Log the entire request details
    console.log('Received inbound email webhook');
    console.log('Method:', request.method);
    console.log('URL:', request.url);
    
    // Log all headers
    const headers = Object.fromEntries(request.headers.entries());
    console.log('Headers:', JSON.stringify(headers, null, 2));
    
    // Get the form data
    const formData = await request.formData();
    
    // Log all form data keys and values
    const formDataObj: FormDataObject = {};
    for (const [key, value] of formData.entries()) {
      formDataObj[key] = value.toString();
    }
    console.log('Complete form data:', JSON.stringify(formDataObj, null, 2));

    // Extract email data from form data
    const from = formData.get('from') as string;
    const to = (formData.get('to') as string)?.replace(/^"[^"]*"\s*/, '').replace(/[<>]/g, '').trim();
    const subject = formData.get('subject') as string;
    const rawText = formData.get('text') as string;
    const html = formData.get('html') as string;
    const envelope = formData.get('envelope') as string;
    
    // Clean the email content by removing quoted text and metadata
    const text = cleanEmailContent(rawText);
    
    // Log the parsed data
    console.log('Parsed email data:', {
      from,
      to,
      subject,
      envelope,
      rawText: rawText?.substring(0, 100) + '...',  // Log just the start of the raw content
      cleanedText: text?.substring(0, 100) + '...',  // Log just the start of the cleaned content
      html: html?.substring(0, 100) + '...'
    });

    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });
    const supabaseAdmin = createRouteHandlerClient({ cookies }, { 
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });

    // First, insert the email
    const { data: emailId, error: emailError } = await supabase.rpc('insert_inbound_email', {
      from_email: from,
      to_email: to,
      subject: subject || '',
      text_content: text || '',  // Use the cleaned text
      html_content: html || '',
      attachments: '[]',  // We'll handle attachments later
      headers: JSON.stringify(headers),
      envelope: envelope || '{}'
    });

    if (emailError) {
      console.error('Error inserting email:', emailError);
      throw emailError;
    }

    // Check if the sender exists in our system
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', from)
      .single();

    if (userError || !user) {
      console.log('User does not exist:', from);
      // TODO: Send an email to inform them they need to create an account
      return NextResponse.json({ 
        success: false, 
        message: 'User does not exist' 
      });
    }

    // Check if this is a reply to an existing ticket
    const ticketIdMatch = subject.match(/\[Ticket #([0-9a-f-]{36})\]/);
    if (ticketIdMatch) {
      const ticketId = ticketIdMatch[1];
      
      // Verify the ticket exists
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select('id')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        console.error('Referenced ticket not found:', ticketId);
        // TODO: Send an email to inform them the ticket wasn't found
        return NextResponse.json({ 
          success: false, 
          message: 'Referenced ticket not found' 
        });
      }

      // Add comment to existing ticket
      const { error: commentError } = await supabase.rpc(
        'add_email_comment_to_ticket',
        {
          p_ticket_id: ticketId,
          p_user_id: user.id,
          p_text_content: text
        }
      );

      if (commentError) {
        console.error('Error adding comment:', commentError);
        throw commentError;
      }

      return NextResponse.json({ 
        success: true, 
        emailId,
        ticketId,
        action: 'comment_added'
      });
    }

    // Create new ticket
    const { data: ticketId, error: ticketError } = await supabase.rpc(
      'create_ticket_from_email',
      {
        p_email_id: emailId,
        p_user_id: user.id
      }
    );

    if (ticketError) {
      console.error('Error creating ticket:', ticketError);
      throw ticketError;
    }

    // Get the ticket details for tag suggestion
    const { data: ticket, error: getTicketError } = await supabase
      .from('tickets')
      .select('id, title, description, organization_id')
      .eq('id', ticketId)
      .single();

    if (getTicketError) {
      console.error('Error getting ticket details:', getTicketError);
      throw getTicketError;
    }

    // Call the suggest-tag endpoint
    try {
      const response = await fetch('https://zendesk-pi.vercel.app/api/tickets/suggest-tag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: ticket.id,
          title: ticket.title,
          description: ticket.description,
          organizationId: ticket.organization_id
        })
      });

      if (!response.ok) {
        console.error('Error from suggest-tag endpoint:', await response.text());
      }
    } catch (suggestTagError) {
      // Log but don't throw the error - we don't want to fail the email/ticket creation
      console.error('Error calling suggest-tag endpoint:', suggestTagError);
    }

    return NextResponse.json({ 
      success: true, 
      emailId, 
      ticketId,
      action: 'ticket_created'
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to process inbound email'
      },
      { status: 500 }
    );
  }
}

function cleanEmailContent(text: string): string {
  if (!text) return '';

  // Split the text into lines
  const lines = text.split('\n');
  const cleanedLines: string[] = [];

  // Common email reply patterns
  const replyPatterns = [
    /^On .* wrote:$/,           // "On [date], [someone] wrote:"
    /^>./,                      // Quoted text starting with >
    /-{3,}/,                   // Horizontal rules (---)
    /_{3,}/,                   // Horizontal rules (___)
    /^Sent from/i,             // Mobile signatures
    /^From:/i,                 // Forwarded message headers
    /^To:/i,
    /^Subject:/i,
    /^Date:/i,
    /^Reply-To:/i,
    /^CC:/i
  ];

  let foundReplyMarker = false;

  // Process each line
  for (const line of lines) {
    // Check if we've hit a reply marker
    if (replyPatterns.some(pattern => pattern.test(line.trim()))) {
      foundReplyMarker = true;
      break;
    }

    // If we haven't hit a reply marker, keep the line
    if (!foundReplyMarker) {
      cleanedLines.push(line);
    }
  }

  // Join the lines back together and clean up whitespace
  return cleanedLines
    .join('\n')
    .trim()
    .replace(/\n{3,}/g, '\n\n'); // Replace multiple blank lines with just two
} 