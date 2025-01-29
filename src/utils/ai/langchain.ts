import { ChatOpenAI } from '@langchain/openai';
import { Client } from 'langsmith';
import { LangChainTracer } from 'langchain/callbacks';

// Initialize LangSmith client for feedback
const client = new Client({
  apiKey: process.env.LANGCHAIN_API_KEY,
});

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

interface AnalysisResult {
  technicalAccuracy: string;
  conversationFlow: string;
  customerSentiment: string;
  responseQuality: string;
  kbUtilization: string;
}

// Create a traced chain that will show up in LangSmith
export async function createTracedChain(context: RunContext) {
  const tracer = new LangChainTracer({
    projectName: process.env.LANGCHAIN_PROJECT,
  });

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
    callbacks: [tracer],
  });

  return model;
}

// Create an evaluation chain
export async function createEvaluationChain(context: RunContext) {
  const tracer = new LangChainTracer({
    projectName: process.env.LANGCHAIN_PROJECT,
  });

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
    callbacks: [tracer],
  });

  return model;
}

// Helper to add feedback in LangSmith
export async function markRunOutcome(
  eventId: string,
  outcome: 'success' | 'handoff' | 'note_created' | 'note_creation_failed',
  metadata?: Record<string, any>
) {
  try {
    // Add feedback to the run in LangSmith
    await client.createFeedback(eventId, 'outcome', {
      value: outcome,
      comment: metadata?.reason,
      score: metadata?.confidence,
      sourceInfo: {
        kbGaps: metadata?.kbGaps,
        analysis: metadata?.analysis,
      },
    });
  } catch (error) {
    console.error('Error adding feedback to LangSmith:', error);
  }
}