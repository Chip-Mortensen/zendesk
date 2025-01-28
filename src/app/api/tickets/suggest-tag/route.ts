import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize service role client with additional options
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'public'
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

// Test the client on initialization
async function testClient() {
  try {
    await supabaseAdmin.from('tickets').select('count').limit(1).single();
    console.log('Service role client initialized successfully');
  } catch (error) {
    console.error('Service role client initialization error:', error);
  }
}

void testClient();

// Log Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log('Supabase URL configured:', !!supabaseUrl);
console.log('Supabase service key configured:', !!supabaseServiceKey);

async function waitForTicket(ticketId: string, maxAttempts = 3): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    console.log(`Attempt ${i + 1} of ${maxAttempts} to verify ticket...`);
    const { data, error } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('id', ticketId);
    
    if (!error && data && data.length > 0) {
      console.log('Ticket found:', data[0]);
      return true;
    }
    
    console.log('Ticket not found yet, waiting 1 second...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

export async function POST(request: Request) {
  console.log('Suggest-tag route called');
  try {
    const body = await request.json();
    console.log('Request body:', body);
    
    const { ticketId, title, description, organizationId } = body;
    
    // Log the extracted values
    console.log('Extracted values:', {
      ticketId,
      title,
      description: description?.substring(0, 100) + '...',  // Log just first 100 chars of description
      organizationId
    });

    // Validate required fields
    if (!ticketId || !title || !description || !organizationId) {
      console.error('Missing required fields:', {
        hasTicketId: !!ticketId,
        hasTitle: !!title,
        hasDescription: !!description,
        hasOrganizationId: !!organizationId
      });
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Make it synchronous by awaiting the process
    console.log('Starting tag suggestion process...');
    await processSuggestion(ticketId, title, description, organizationId);
    console.log('Tag suggestion process completed successfully');

    return NextResponse.json({ success: true, message: 'Tag suggestion completed' });
  } catch (error) {
    console.error('Server: Error in tag suggestion:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process tag suggestion' },
      { status: 500 }
    );
  }
}

async function processSuggestion(ticketId: string, title: string, description: string, organizationId: string) {
  try {
    // Wait for ticket to be available
    console.log('Waiting for ticket to be available...');
    const ticketExists = await waitForTicket(ticketId);
    
    if (!ticketExists) {
      throw new Error('Ticket not found after multiple attempts');
    }

    console.log('Getting existing tags for organization:', organizationId);
    // Get existing tags for the organization using service role client
    const { data: tags, error: tagsError } = await supabaseAdmin
      .from('tags')
      .select('*')
      .eq('organization_id', organizationId);

    if (tagsError) {
      console.error('Error fetching tags:', tagsError);
      throw tagsError;
    }

    console.log('Available tags:', tags);

    // If no existing tags, we can't make a suggestion
    if (!tags?.length) {
      console.log('No existing tags found, skipping suggestion');
      return;
    }

    const prompt = `Given the following support ticket, suggest the most appropriate tag from these options: ${tags.map(t => t.name).join(', ')}. If none fit well, respond with "null".

Title: ${title}
Description: ${description}

Tag:`;

    console.log('Sending request to OpenAI with prompt:', prompt);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10,
      temperature: 0.3
    });

    const suggestedTagName = completion.choices[0].message.content?.trim();
    console.log('Received suggested tag name:', suggestedTagName);
    
    // Find the tag ID for the suggested tag name
    const suggestedTag = suggestedTagName === "null" ? null : 
      tags.find(t => t.name === suggestedTagName);
    
    if (suggestedTagName !== "null" && !suggestedTag) {
      console.log('Suggested tag not found in existing tags:', suggestedTagName);
      return;
    }

    console.log('Updating ticket with tag ID:', suggestedTag?.id);
    
    // Update the ticket with the tag ID
    const { error: updateOnlyError } = await supabaseAdmin
      .from('tickets')
      .update({ tag_id: suggestedTag?.id || null })
      .eq('id', ticketId);

    if (updateOnlyError) {
      console.error('Error on update-only operation:', updateOnlyError);
      throw updateOnlyError;
    }

    // Now verify the update worked
    console.log('Verifying update...');
    const { data: verifyUpdate, error: verifyError } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (verifyError) {
      console.error('Error verifying update:', verifyError);
      throw verifyError;
    }

    console.log('Ticket state after update:', verifyUpdate);

    console.log('Looking for best assignee for tag:', suggestedTagName);
    // Find the best assignee for this tag using service role client
    const rpcResponse = await supabaseAdmin.rpc('find_best_assignee', {
      p_organization_id: organizationId,
      p_tag_id: suggestedTag?.id || null
    });

    if (rpcResponse.error) {
      console.error('Error finding best assignee:', rpcResponse.error);
      throw rpcResponse.error;
    }

    // The function returns just the UUID directly
    const assigneeId = rpcResponse.data;
    console.log('Found best assignee:', assigneeId);

    // Update the ticket with the found assignee using service role client
    if (assigneeId) {
      console.log('Updating ticket with assignee:', assigneeId);
      const { data: assigneeUpdateData, error: updateError } = await supabaseAdmin
        .from('tickets')
        .update({ assigned_to: assigneeId })
        .eq('id', ticketId)
        .select()
        .single();

      console.log('Assignee update response:', { data: assigneeUpdateData, error: updateError });

      if (updateError) {
        console.error('Error updating ticket assignee:', updateError);
        throw updateError;
      }

      // Verify the assignee was updated
      const { data: verifyAssignee } = await supabaseAdmin
        .from('tickets')
        .select('assigned_to')
        .eq('id', ticketId)
        .single();
      
      console.log('Verified assignee after update:', verifyAssignee);
      console.log('Successfully updated ticket assignee');
    } else {
      console.log('No suitable assignee found');
    }
  } catch (error) {
    console.error('Error in tag suggestion process:', error);
    // Add more context to the error
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    throw error;
  }
} 