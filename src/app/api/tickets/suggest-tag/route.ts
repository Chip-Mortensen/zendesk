import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize service role client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process tag suggestion'
      },
      { status: 500 }
    );
  }
}

async function processSuggestion(ticketId: string, title: string, description: string, organizationId: string) {
  try {
    console.log('Getting existing tags for organization:', organizationId);
    // Get existing tags for the organization using service role client
    const { data: ticketTags, error: tagsError } = await supabaseAdmin
      .from('tickets')
      .select('tag')
      .eq('organization_id', organizationId)
      .not('tag', 'is', null);

    if (tagsError) {
      console.error('Error fetching tags:', tagsError);
      throw tagsError;
    }

    console.log('Raw ticket tags:', ticketTags);
    const existingTags = [...new Set(ticketTags?.map(t => t.tag))];
    console.log('Unique existing tags:', existingTags);

    // If no existing tags, we can't make a suggestion
    if (!existingTags.length) {
      console.log('No existing tags found, skipping suggestion');
      return;
    }

    const prompt = `Given the following support ticket, suggest the most appropriate tag from these options: ${existingTags.join(', ')}. If none fit well, respond with "null".

Title: ${title}
Description: ${description}

Tag:`;

    console.log('Sending request to OpenAI with prompt:', prompt);
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10,
      temperature: 0.3
    });

    const suggestedTag = completion.choices[0].message.content?.trim();
    console.log('Received suggested tag:', suggestedTag);
    
    // Only update if the suggested tag exists in our list or is null
    if (suggestedTag === "null" || existingTags.includes(suggestedTag!)) {
      console.log('Updating ticket with tag:', suggestedTag);
      // Update the tag using service role client
      const { error: tagError } = await supabaseAdmin
        .from('tickets')
        .update({ tag: suggestedTag === "null" ? null : suggestedTag })
        .eq('id', ticketId);

      if (tagError) {
        console.error('Error updating ticket tag:', tagError);
        throw tagError;
      }

      console.log('Looking for best assignee for tag:', suggestedTag);
      // Find the best assignee for this tag using service role client
      const rpcResponse = await supabaseAdmin.rpc('find_best_assignee', {
        p_organization_id: organizationId,
        p_tag: suggestedTag === "null" ? null : suggestedTag
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
        const { error: updateError } = await supabaseAdmin
          .from('tickets')
          .update({ assigned_to: assigneeId })
          .eq('id', ticketId);

        if (updateError) {
          console.error('Error updating ticket assignee:', updateError);
          throw updateError;
        }
        console.log('Successfully updated ticket assignee');
      } else {
        console.log('No suitable assignee found');
      }
    } else {
      console.log('Suggested tag not in existing tags list:', {
        suggestedTag,
        existingTags
      });
    }
  } catch (error) {
    console.error('Error in tag suggestion process:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    throw error; // Re-throw the error to be caught by the main handler
  }
} 