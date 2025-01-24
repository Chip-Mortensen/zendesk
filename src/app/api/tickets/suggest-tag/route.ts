import OpenAI from 'openai';
import { supabase } from '@/utils/supabase';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  try {
    const { ticketId, title, description, organizationId } = await request.json();
    
    // Make it synchronous by awaiting the process
    await processSuggestion(ticketId, title, description, organizationId);

    return NextResponse.json({ success: true, message: 'Tag suggestion completed' });
  } catch (error) {
    console.error('Server: Error in tag suggestion:', error);
    return NextResponse.json({ success: false, error: 'Failed to process tag suggestion' }, { status: 500 });
  }
}

async function processSuggestion(ticketId: string, title: string, description: string, organizationId: string) {
  try {
    // Get existing tags for the organization
    const { data: ticketTags } = await supabase
      .from('tickets')
      .select('tag')
      .eq('organization_id', organizationId)
      .not('tag', 'is', null);

    const existingTags = [...new Set(ticketTags?.map(t => t.tag))];

    // If no existing tags, we can't make a suggestion
    if (!existingTags.length) {
      return;
    }

    const prompt = `Given the following support ticket, suggest the most appropriate tag from these options: ${existingTags.join(', ')}. If none fit well, respond with "null".

Title: ${title}
Description: ${description}

Tag:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10,
      temperature: 0.3
    });

    const suggestedTag = completion.choices[0].message.content?.trim();
    
    // Only update if the suggested tag exists in our list or is null
    if (suggestedTag === "null" || existingTags.includes(suggestedTag!)) {
      // First update the tag
      const { error: tagError } = await supabase
        .from('tickets')
        .update({ tag: suggestedTag === "null" ? null : suggestedTag })
        .eq('id', ticketId);

      if (tagError) {
        console.error('Error updating ticket tag:', tagError);
        throw tagError;
      }

      // Find the best assignee for this tag
      const rpcResponse = await supabase.rpc('find_best_assignee', {
        p_organization_id: organizationId,
        p_tag: suggestedTag === "null" ? null : suggestedTag
      });

      // The function returns just the UUID directly
      const assigneeId = rpcResponse.data;

      if (rpcResponse.error) {
        console.error('Error finding best assignee:', rpcResponse.error);
        throw rpcResponse.error;
      }

      // Update the ticket with the found assignee
      if (assigneeId) {
        const { error: updateError } = await supabase
          .from('tickets')
          .update({ assigned_to: assigneeId })
          .eq('id', ticketId);

        if (updateError) {
          console.error('Error updating ticket assignee:', updateError);
          throw updateError;
        }
      }
    }
  } catch (error) {
    console.error('Error in tag suggestion process:', error);
    throw error; // Re-throw the error to be caught by the main handler
  }
} 