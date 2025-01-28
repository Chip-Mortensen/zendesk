import { ChatOpenAI } from '@langchain/openai';
import { Client } from 'langsmith';

// Initialize LangSmith client for feedback
const client = new Client();

interface RunMetadata {
  ticketId: string;
  eventId: string;
  session_name: string;
  kbArticlesFound?: number;
  conversationLength?: number;
  [key: string]: string | number | undefined;
}

interface RunContext {
  ticketId: string;
  eventId: string;
  step: string;
  metadata?: Partial<RunMetadata>;
}

// Create a traced chain that will show up in LangSmith
export async function createTracedChain(context: RunContext) {
  // LangSmith tracing is enabled automatically via LANGCHAIN_API_KEY
  // and LANGCHAIN_PROJECT environment variables
  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 1000,
  }).withConfig({
    tags: [context.step],
    metadata: {
      ticketId: context.ticketId,
      eventId: context.eventId,
      session_name: `ticket_${context.ticketId}`,
      ...context.metadata,
    } as RunMetadata,
  });

  return model;
}

// Create an evaluation chain
export async function createEvaluationChain(context: RunContext) {
  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.1, // Lower temperature for more consistent evaluation
    maxTokens: 1000,
  }).withConfig({
    tags: ['evaluation', context.step],
    metadata: {
      ticketId: context.ticketId,
      eventId: context.eventId,
      session_name: `ticket_${context.ticketId}`,
      ...context.metadata,
    } as RunMetadata,
  });

  return model;
}

// Helper to add feedback in LangSmith
export async function markRunOutcome(
  runId: string,
  outcome: 'success' | 'handoff',
  details: {
    reason?: string;
    confidence?: number;
    kbGaps?: string[];
  }
) {
  try {
    // Add feedback to the run in LangSmith
    await client.createFeedback(runId, 'outcome', {
      value: outcome,
      comment: details.reason,
      score: details.confidence,
      sourceInfo: {
        kbGaps: details.kbGaps,
      },
    });
  } catch (error) {
    console.error('Error adding feedback to LangSmith:', error);
  }
}