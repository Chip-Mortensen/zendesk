import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Log everything we receive for debugging
    console.log('Received inbound email webhook');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    
    // Get the form data
    const formData = await request.formData();
    console.log('Form data keys:', Array.from(formData.keys()));

    // Extract email data from form data
    const from = formData.get('from') as string;
    const to = formData.get('to') as string;
    const subject = formData.get('subject') as string;
    const text = formData.get('text') as string;
    const html = formData.get('html') as string;
    
    // Log the parsed data
    console.log('Parsed email data:', { from, to, subject });

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
      headers: '{}',      // We'll handle headers later
      envelope: '{}'      // We'll handle envelope later
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