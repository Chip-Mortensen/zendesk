import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { OpenAIEmbeddings } from '@langchain/openai'
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages'
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
  analysis: {
    technicalAccuracy: string;
    conversationFlow: string;
    customerSentiment: string;
    responseQuality: string;
    kbUtilization: string;
  };
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
      "You are a helpful customer service assistant. Your goal is to:\n" +
      "1. Provide clear, actionable solutions\n" +
      "2. Reference relevant documentation when available\n" +
      "3. Match the customer's technical level\n" +
      "4. Show empathy and attention to customer sentiment\n" +
      "5. Be thorough but concise"
    )

    // Add strict formatting rules
    const formattingRules = new SystemMessage(
      "IMPORTANT - Follow these formatting rules exactly:\n" +
      "1. Use ONLY plain text in responses\n" +
      "2. NO markdown formatting of any kind\n" +
      "3. NO special characters for formatting\n" +
      "4. When including links, use the full URL as is\n" +
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
      `You are evaluating an AI's response to a customer support ticket. Your job is to determine if human intervention is needed. Responses do not need to be perfect, but they should be helpful and actionable.

      Evaluation Criteria:
      1. Technical Accuracy:
         - Is the response technically correct?
         - Does it align with the provided KB articles? If it is not present in the KB, that is a failure.
         - Is it making up information not present in KB?
         - Are article references accurate and relevant?

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
        "reason": string (detailed explanation if handoff needed),
        "analysisFailure": string (which category of failure: technicalAccuracy, conversationFlow, customerSentiment, responseQuality, kbUtilization),
        "confidence": number (0-1),
        "kbGaps": string[] (list of missing or needed KB topics),
        "analysis": {
          "technicalAccuracy": string (assessment of technical correctness),
          "conversationFlow": string (assessment of conversation progression),
          "customerSentiment": string (assessment of customer state),
          "responseQuality": string (assessment of AI's response effectiveness),
          "kbUtilization": string (assessment of KB article usage)
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
            technicalAccuracy: 'Failed to evaluate',
            conversationFlow: 'Failed to evaluate',
            customerSentiment: 'Failed to evaluate',
            responseQuality: 'Failed to evaluate',
            kbUtilization: 'Failed to evaluate'
          }
        }

    // If evaluation suggests handoff, update ticket and notify agent
    if (evalResult.needsHandoff) {
      // Update ticket to disable AI and store complete evaluation
      await supabase
        .from('tickets')
        .update({
          ai_enabled: false,
          last_handoff_reason: evalResult // Store the complete evaluation result
        })
        .eq('id', ticket.id)

      await markRunOutcome(event.id, 'handoff', {
        reason: evalResult.reason,
        confidence: evalResult.confidence,
        kbGaps: evalResult.kbGaps,
        analysis: evalResult.analysis
      })

      return NextResponse.json({
        status: 'handoff',
        evaluation: evalResult // Return complete evaluation in response
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