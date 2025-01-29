import { ChatOpenAI } from '@langchain/openai';
import { LangChainTracer } from 'langchain/callbacks';

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
  const tracer = new LangChainTracer({
    projectName: process.env.LANGCHAIN_PROJECT,
  });

  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 2000,
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
    temperature: 0.1,
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