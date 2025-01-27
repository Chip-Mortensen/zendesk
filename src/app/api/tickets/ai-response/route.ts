import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { LangChainTracer } from 'langchain/callbacks'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  openAIApiKey: process.env.OPENAI_API_KEY
})

const tracer = new LangChainTracer({
  projectName: process.env.LANGCHAIN_PROJECT
})

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
    const messages = events?.map(e => ({
      role: e.created_by === ticket.created_by ? 'user' as const : 'assistant' as const,
      content: e.comment_text || ''
    })) || []

    // Get AI response using LangChain
    const response = await model.invoke(messages, {
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