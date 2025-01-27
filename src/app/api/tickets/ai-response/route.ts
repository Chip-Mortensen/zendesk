import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { OpenAIEmbeddings } from '@langchain/openai'
import { LangChainTracer } from 'langchain/callbacks'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  openAIApiKey: process.env.OPENAI_API_KEY
})

const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  openAIApiKey: process.env.OPENAI_API_KEY
})

const tracer = new LangChainTracer({
  projectName: process.env.LANGCHAIN_PROJECT
})

interface KBArticle {
  id: string;
  title: string;
  content: string;
  author_name: string;
  created_at: string;
  published_at: string;
  similarity: number;
}

async function searchKBArticles(comment: string, organizationId: string): Promise<KBArticle[]> {
  const vector = await embeddings.embedQuery(comment)
  const { data: articles } = await supabase.rpc('search_kb_articles', {
    query_embedding: vector,
    organization_id: organizationId
  })
  
  return articles || []
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

    // Search for relevant KB articles
    const relevantArticles = await searchKBArticles(event.comment_text, ticket.organization_id)
    
    // Add KB context as a system message if we found any relevant articles
    const allMessages = relevantArticles.length > 0 
      ? [
          new SystemMessage(
            "Relevant knowledge base articles:\n\n" +
            relevantArticles.map(article => 
              `Title: ${article.title}\n${article.content}\n---`
            ).join("\n") +
            "\n\nPlease use this knowledge base information to help inform your response."
          ),
          ...messages
        ]
      : messages

    // Get AI response using LangChain
    const response = await model.invoke(allMessages, {
      callbacks: [tracer]
    })

    const aiResponse = response.content

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

    return NextResponse.json({ status: 'success', response: aiResponse })
  } catch (error) {
    console.error('Error in AI response route:', error)
    return NextResponse.json(
      { error: 'Failed to process AI response' },
      { status: 500 }
    )
  }
} 