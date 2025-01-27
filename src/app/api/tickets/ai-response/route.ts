import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase with service role for admin access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { ticketId, eventId, commentText } = await request.json();
    console.log('AI Response Trigger Received:', {
      timestamp: new Date().toISOString(),
      ticketId,
      eventId,
      commentText
    });

    // Get ticket context including assigned_to
    const { data: ticket } = await supabase
      .from('tickets')
      .select('title, description, assigned_to')
      .eq('id', ticketId)
      .single();

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (!ticket.assigned_to) {
      console.log('No assigned user for ticket:', ticketId);
      return NextResponse.json({ status: 'skipped', reason: 'no_assignee' });
    }

    // Generate AI response
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful customer service representative. Provide a friendly, professional response to the customer's message. Keep responses concise but helpful."
        },
        {
          role: "user",
          content: `Ticket Context:
Title: ${ticket.title}
Description: ${ticket.description}

Customer's Latest Comment: ${commentText}

Please provide a response to the customer.`
        }
      ]
    });

    const aiResponse = response.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error('Failed to generate AI response');
    }

    // Create comment event using assigned_to user
    const event = {
      ticket_id: ticketId,
      event_type: 'comment',
      created_by: ticket.assigned_to,
      comment_text: aiResponse
    };

    const { error: eventError } = await supabase
      .from('ticket_events')
      .insert([event]);

    if (eventError) throw eventError;

    return NextResponse.json({ status: 'success', response: aiResponse });
  } catch (error) {
    console.error('Error in AI response route:', error);
    return NextResponse.json(
      { error: 'Failed to process AI response' },
      { status: 500 }
    );
  }
} 