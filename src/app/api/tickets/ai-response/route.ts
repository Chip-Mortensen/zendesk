import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { OpenAIEmbeddings } from '@langchain/openai'
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages'
import { createTracedChain, createEvaluationChain } from '@/utils/ai/langchain'
import { EvaluationResult } from '@/types/tickets'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  openAIApiKey: process.env.OPENAI_API_KEY
})

interface KBArticle {
  id: string;
  title: string;
  content: string;
  author_name: string;
  created_at: string;
  published_at: string;
  similarity: number;
  organization_slug?: string;
}

async function searchKBArticles(comment: string, organizationId: string): Promise<KBArticle[]> {
  // First get org slug
  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', organizationId)
    .single()

  // Then get articles with org slug
  const vector = await embeddings.embedQuery(comment)
  const { data: articles } = await supabase.rpc('search_kb_articles', {
    query_embedding: vector,
    organization_id: organizationId
  })
  
  return (articles || []).map((article: Omit<KBArticle, 'organization_slug'>) => ({
    ...article,
    organization_slug: org?.slug
  }))
}

export async function POST(request: Request) {
  try {
    const webhookPayload = await request.json()
    const event = webhookPayload.record

    // Check if this is a comment event
    if (event.event_type !== 'comment') {
      return NextResponse.json({ status: 'skipped', reason: 'not a comment event' })
    }

    // Get ticket to check AI enabled and if comment is from customer
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', event.ticket_id)
      .single()

    if (ticketError || !ticket) {
      console.error('Error fetching ticket:', ticketError)
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Check if AI is enabled and comment is from customer
    if (!ticket.ai_enabled || ticket.created_by !== event.created_by) {
      return NextResponse.json({ status: 'skipped', reason: 'AI disabled or not customer comment' })
    }

    // Search for relevant KB articles first
    const relevantArticles = await searchKBArticles(event.comment_text, ticket.organization_id)

    // Get ticket context for AI
    const { data: events } = await supabase
      .from('ticket_events')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true })

    // Format conversation history
    const messages = events?.flatMap(e => {
      if (e.event_type === 'comment') {
        return [
          e.created_by === ticket.created_by
            ? new HumanMessage(e.comment_text || '')
            : new AIMessage(e.comment_text || '')
        ]
      }
      
      // Format non-comment events as system messages
      let eventDescription = ''
      switch (e.event_type) {
        case 'status_change':
          eventDescription = `Ticket status changed to ${e.new_status}`
          break
        case 'assignee_change':
          eventDescription = `Ticket assigned to ${e.new_assignee}`
          break
        case 'priority_change':
          eventDescription = `Ticket priority set to ${e.new_priority}`
          break
        default:
          return []
      }

      return eventDescription ? [new SystemMessage(eventDescription)] : []
    }) || []
    
    // Add role and approach instructions
    const roleInstructions = new SystemMessage(
      "You are a customer service assistant with a CRITICAL CONSTRAINT: You must ONLY provide information that is explicitly stated in the knowledge base articles provided.\n\n" +
      "CORE RULES:\n" +
      "1. NEVER suggest or imply any policy, procedure, or functionality that isn't explicitly documented in the KB articles\n" +
      "2. When the KB doesn't fully answer a question, only offer the information that is present in the KB articles\n" +
      "3. State clearly what is in the knowledge base, do not paraphrase or show uncertainty\n" +
      "4. ALWAYS provide the complete answer from the KB article - don't just tell them to read the article\n" +
      "5. Include both the answer AND the article link - the link is for reference, not as a substitute for answering\n" +
      "6. Do not present alternatives while trying to be helpful, just state what is in the knowledge base\n\n" +
      "YOUR GOALS:\n" +
      "1. Answer questions completely using information from KB articles\n" +
      "2. Include relevant KB article links alongside your answers\n" +
      "3. Match the customer's technical level while staying within KB bounds\n" +
      "4. Show empathy without making unsupported claims"
    )

    // Add strict formatting rules
    const formattingRules = new SystemMessage(
      "IMPORTANT - Follow these formatting and content rules exactly:\n" +
      "1. Use ONLY plain text in responses\n" +
      "2. NO markdown formatting of any kind\n" +
      "3. NO special characters for formatting\n" +
      "4. When referencing KB information, always include the full URL\n" +
      "5. Format lists with simple numbers or letters followed by a period"
    )

    // Update KB context message
    const allMessages = relevantArticles.length > 0 
      ? [
          roleInstructions,
          new SystemMessage(
            "Relevant knowledge base articles:\n\n" +
            relevantArticles.map(article => 
              `Title: ${article.title}\n` +
              `Link: ${process.env.DEPLOYED_URL}/${article.organization_slug}/kb/${article.id}\n` +
              `Summary: ${article.content.slice(0, 200)}...\n---`
            ).join("\n") +
            "\n\nWhen referencing these articles, use the provided links instead of including full content."
          ),
          ...messages,
          formattingRules
        ]
      : [roleInstructions, ...messages, formattingRules]

    // Create traced model for response generation
    const model = await createTracedChain({
      ticketId: ticket.id,
      eventId: event.id,
      step: 'generate_response',
      metadata: {
        kbArticlesFound: relevantArticles.length,
        conversationLength: messages.length
      }
    })

    // Get AI response using traced model
    const response = await model.invoke(allMessages)
    const aiResponse = response instanceof AIMessage ? response.content : response

    // Create evaluation model
    const evaluator = await createEvaluationChain({
      ticketId: ticket.id,
      eventId: event.id,
      step: 'evaluate_response',
      metadata: {
        kbArticlesFound: relevantArticles.length,
        conversationLength: messages.length
      }
    })

    // Format conversation history for evaluation
    const conversationHistory = messages
      .slice(0, -1) // Exclude the most recent message
      .map((m: BaseMessage) => {
        if (m instanceof HumanMessage) {
          return `Customer: ${m.content}`;
        } else if (m instanceof AIMessage) {
          return `AI: ${m.content}`;
        } else {
          return `System: ${m.content}`;
        }
      }).join('\n\n');

    // Evaluate the response
    const evaluationPrompt = new SystemMessage(
      `You are evaluating an AI's response to a customer support ticket. Your PRIMARY and MOST CRITICAL responsibility is to ensure the AI NEVER provides information that isn't explicitly supported by the knowledge base articles. Any response containing uncertain or made-up information MUST be flagged for human review.

      CRITICAL EVALUATION RULES:
      1. Knowledge Base Accuracy (IMMEDIATE FAILURE if violated):
         - The response MUST ONLY contain information explicitly present in the provided KB articles
         - ANY speculation, assumption, or information not directly from KB articles is an IMMEDIATE FAILURE
         - If a customer's question cannot be fully answered with available KB articles, flag for human review
         - Partial answers are acceptable ONLY if they are supported by KB articles
         - Links to KB articles should be provided when referencing information
         - Technical accuracy must be maintained within the scope of KB content

      Secondary Evaluation Criteria (evaluate only if KB accuracy passes):
      2. Conversation Context:
         - Does the response acknowledge previous interactions?
         - Is it repeating information already discussed?
         - Is it maintaining context from earlier messages?
         - Are we going in circles with the customer?

      3. Customer Sentiment:
         - Is the customer showing signs of frustration?
         - Has the tone escalated over time?
         - Are we addressing the emotional context appropriately?
         - Is this a complex issue causing repeated back-and-forth?

      4. Response Quality:
         - Is the solution actionable and clear?
         - Are we missing key information needed to resolve the issue?
         - Is the response appropriate for the customer's technical level?
         - Are we properly leveraging available KB articles?

      Previous Conversation History:
      ${conversationHistory || "No previous messages - this is the first interaction"}

      Latest Customer Message:
      ${event.comment_text}

      AI's Response:
      ${aiResponse}

      Available KB Articles:
      ${relevantArticles.map(article => 
        `Title: ${article.title}
         URL: ${process.env.DEPLOYED_URL}/${article.organization_slug}/kb/${article.id}
         Content: ${article.content}
         Similarity Score: ${article.similarity}
        `
      ).join('\n\n')}

      Evaluate and respond with JSON only:
      {
        "needsHandoff": boolean,
        "reason": string (MUST detail any KB accuracy violations or explain why human review is needed),
        "analysisFailure": string (which category of failure, with 'kbAccuracy' being most critical),
        "confidence": number (0-1, how confident are you in your decision on handing off or not),
        "kbGaps": string[] (list of topics from the customer's question that aren't covered by current KB),
        "analysis": {
          "kbAccuracy": string (assessment of response accuracy and technical correctness based on KB),
          "conversationFlow": string (assessment of conversation progression),
          "customerSentiment": string (assessment of customer state),
          "responseQuality": string (assessment of response effectiveness)
        }
      }`
    )

    const evaluation = await evaluator.invoke([evaluationPrompt])
    const evalContent = evaluation instanceof AIMessage ? evaluation.content : evaluation
    const evalResult: EvaluationResult = typeof evalContent === 'string' 
      ? JSON.parse(evalContent)
      : { 
          needsHandoff: true, 
          reason: 'Invalid evaluation response', 
          confidence: 0, 
          kbGaps: [],
          analysis: {
            kbAccuracy: 'Failed to evaluate',
            conversationFlow: 'Failed to evaluate',
            customerSentiment: 'Failed to evaluate',
            responseQuality: 'Failed to evaluate'
          }
        }

    // If evaluation suggests handoff, update ticket and notify agent
    if (evalResult.needsHandoff) {
      // Generate concise conversation summary
      const summaryChain = await createTracedChain({
        ticketId: ticket.id,
        eventId: event.id,
        step: 'create_conversation_summary'
      });

      const summaryPrompt = new SystemMessage(
        `Summarize this customer support conversation in one short paragraph. Focus only on the key points and current status.

        Conversation History:
        ${conversationHistory || "No previous messages"}

        Latest Customer Message:
        ${event.comment_text}`
      );

      const summaryResponse = await summaryChain.invoke([summaryPrompt]);
      const conversationSummary = summaryResponse instanceof AIMessage ? summaryResponse.content : summaryResponse;

      // Create internal note with just the key information
      const handoffNote = `
Proposed AI Response (Not Sent):


"${aiResponse}"


Reason for Handoff:


"${evalResult.reason}"


Summary of Conversation:


"${conversationSummary}"`;

      // Create the internal note
      const { error: noteError } = await supabase
        .from('ticket_events')
        .insert({
          ticket_id: ticket.id,
          event_type: 'note',
          comment_text: handoffNote,
          created_by: ticket.assigned_to || event.created_by,
          is_ai_response: true
        });

      if (noteError) {
        console.error('Error creating handoff note:', noteError);
      }

      // Update ticket to disable AI
      await supabase
        .from('tickets')
        .update({
          ai_enabled: false,
          last_handoff_reason: evalResult
        })
        .eq('id', ticket.id);

      return NextResponse.json({
        status: 'handoff',
        reason: evalResult
      });
    }

    // Create AI response event
    const { error: responseError } = await supabase
      .from('ticket_events')
      .insert({
        ticket_id: ticket.id,
        event_type: 'comment',
        comment_text: aiResponse,
        created_by: ticket.assigned_to,
        is_ai_response: true
      })

    if (responseError) {
      console.error('Error creating AI response:', responseError)
      return NextResponse.json({ error: 'Failed to create AI response' }, { status: 500 })
    }

    return NextResponse.json({ status: 'success', response: aiResponse })
  } catch (error) {
    console.error('Error in AI response route:', error)
    return NextResponse.json(
      { error: 'Failed to process AI response' },
      { status: 500 }
    )
  }
} 