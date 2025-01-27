import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase with service role for vector operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { query, organizationId } = await request.json();

    if (!query || !organizationId) {
      return NextResponse.json(
        { error: 'Query and organizationId are required' },
        { status: 400 }
      );
    }

    // Generate embedding for search query
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float",
    });

    const embedding = response.data[0].embedding;

    // Perform vector similarity search
    const { data: articles, error } = await supabase.rpc('search_kb_articles', {
      query_embedding: embedding,
      organization_id: organizationId
    });

    if (error) {
      console.error('Search error:', error);
      throw error;
    }

    return NextResponse.json({ articles });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
} 