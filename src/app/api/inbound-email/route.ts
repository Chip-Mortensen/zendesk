import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

interface InboundEmailFormData {
  from: string;
  to: string;
  subject?: string;
  text?: string;
  html?: string;
  envelope?: string;
  [key: string]: FormDataEntryValue | undefined;
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
    
    // Initialize with required properties
    const formDataObj: InboundEmailFormData = {
      from: formData.get('from') as string,
      to: formData.get('to') as string,
    };
    
    // Add all other form data entries
    for (const [key, value] of formData.entries()) {
      if (key !== 'from' && key !== 'to') {
        formDataObj[key] = value;
      }
    }
    console.log('Complete form data:', JSON.stringify(formDataObj, null, 2));

    // Extract email data from form data
    const from = formDataObj.from;
    const to = formDataObj.to.replace(/^"[^"]*"\s*/, '').replace(/[<>]/g, '').trim();
    const subject = formData.get('subject') as string;
    const text = formData.get('text') as string;
    const html = formData.get('html') as string;
    const envelope = formData.get('envelope') as string;
    
    // Log the parsed data
    console.log('Parsed email data:', {
      from,
      to,
      subject,
      envelope,
      text: text?.substring(0, 100) + '...',  // Log just the start of the content
      html: html?.substring(0, 100) + '...'
    });

    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });

    // Call the database function to insert the email
    const { data, error } = await supabase.rpc('insert_inbound_email', {
      from_email: from,
      to_email: to,
      subject: subject || '',
      text_content: text || '',
      html_content: html || '',
      attachments: '[]',  // We'll handle attachments later
      headers: JSON.stringify(headers),
      envelope: envelope || '{}'
    });

    if (error) {
      console.error('Error inserting email:', error);
      throw error;
    }

    return NextResponse.json({ success: true, id: data });
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