import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { OpenAIEmbeddings } from '@langchain/openai'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import { createTracedChain, createEvaluationChain, markRunOutcome } from '@/utils/ai/langchain'

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

interface EvaluationResult {
  needsHandoff: boolean;
  reason?: string;
  confidence: number;
  kbGaps: string[];
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
    
    // Add initial system message with instructions
    const baseInstructions = new SystemMessage(
      "You are a helpful customer service assistant. Follow these guidelines:\n" +
      "1. Keep responses concise and direct\n" +
      "2. Do not use any markdown formatting\n" +
      "3. When a topic needs more detail, provide a link to the relevant article\n" +
      "4. Use plain text only\n" +
      "5. Focus on actionable solutions"
    )

    // Update KB context message
    const allMessages = relevantArticles.length > 0 
      ? [
          baseInstructions,
          new SystemMessage(
            "Relevant knowledge base articles:\n\n" +
            relevantArticles.map(article => 
              `Title: ${article.title}\n` +
              `Link: ${process.env.DEPLOYED_URL}/${article.organization_slug}/kb/${article.id}\n` +
              `Summary: ${article.content.slice(0, 200)}...\n---`
            ).join("\n") +
            "\n\nWhen referencing these articles, use the provided links instead of including full content."
          ),
          ...messages
        ]
      : [baseInstructions, ...messages]

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

    // Evaluate the response
    const evaluationPrompt = new SystemMessage(
      `You are evaluating an AI's response to a customer support ticket. Consider:
      1. Technical accuracy and completeness
      2. Appropriate use of KB articles
      3. Customer sentiment and frustration level
      4. Response clarity and actionability

      Ticket Context:
      ${event.comment_text}

      AI Response:
      ${aiResponse}

      KB Articles Available: ${relevantArticles.length}

      Evaluate if human intervention is needed. Respond with JSON only:
      {
        "needsHandoff": boolean,
        "reason": string (if needsHandoff is true),
        "confidence": number (0-1),
        "kbGaps": string[] (list of missing topics)
      }`
    )

    const evaluation = await evaluator.invoke([evaluationPrompt])
    const evalContent = evaluation instanceof AIMessage ? evaluation.content : evaluation
    const evalResult: EvaluationResult = typeof evalContent === 'string' 
      ? JSON.parse(evalContent)
      : { needsHandoff: true, reason: 'Invalid evaluation response', confidence: 0, kbGaps: [] }

    // If evaluation suggests handoff, update ticket and notify agent
    if (evalResult.needsHandoff) {
      // Update ticket to disable AI and set handoff reason
      await supabase
        .from('tickets')
        .update({
          ai_enabled: false,
          last_handoff_reason: evalResult.reason
        })
        .eq('id', ticket.id)

      await markRunOutcome(event.id, 'handoff', {
        reason: evalResult.reason,
        confidence: evalResult.confidence,
        kbGaps: evalResult.kbGaps
      })

      return NextResponse.json({
        status: 'handoff',
        reason: evalResult.reason,
        kbGaps: evalResult.kbGaps
      })
    }

    // Create AI response event
    const { error: responseError } = await supabase
      .from('ticket_events')
      .insert({
        ticket_id: ticket.id,
        event_type: 'comment',
        comment_text: aiResponse,
        created_by: ticket.assigned_to
      })

    if (responseError) {
      console.error('Error creating AI response:', responseError)
      return NextResponse.json({ error: 'Failed to create AI response' }, { status: 500 })
    }

    await markRunOutcome(event.id, 'success', {
      confidence: evalResult.confidence,
      kbGaps: evalResult.kbGaps
    })

    return NextResponse.json({ status: 'success', response: aiResponse })
  } catch (error) {
    console.error('Error in AI response route:', error)
    return NextResponse.json(
      { error: 'Failed to process AI response' },
      { status: 500 }
    )
  }
} 