import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to delay execution
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getUnvectorizedArticles() {
  const { data: articles, error } = await supabase
    .from('kb_articles')
    .select('id, title, content')
    .eq('vectorized', false)
    .order('created_at', { ascending: true }); // Consistent ordering for resuming

  if (error) throw error;
  return articles;
}

async function generateEmbedding(text: string, retries = 3): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });

    return response.data[0].embedding;
  } catch (error: any) {
    if (retries > 0 && error?.status === 429) { // Rate limit error
      console.log('⏳ Rate limited, waiting 20 seconds...');
      await sleep(20000); // Wait 20 seconds before retrying
      return generateEmbedding(text, retries - 1);
    }
    throw error;
  }
}

async function vectorizeArticle(articleId: string, title: string, content: string) {
  try {
    // Combine title and content for better semantic search results
    const text = `${title}\n\n${content}`;
    const embedding = await generateEmbedding(text);

    // Insert the embedding
    const { error: insertError } = await supabase
      .from('kb_article_embeddings')
      .insert({
        article_id: articleId,
        embedding
      });

    if (insertError) throw insertError;

    // Update the vectorized status
    const { error: updateError } = await supabase
      .from('kb_articles')
      .update({ vectorized: true })
      .eq('id', articleId);

    if (updateError) throw updateError;

    console.log(`✅ Vectorized article: ${title}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to vectorize article: ${title}`, error);
    return false;
  }
}

async function main() {
  try {
    console.log('🔍 Fetching unvectorized articles...');
    const articles = await getUnvectorizedArticles();
    console.log(`📝 Found ${articles.length} articles to vectorize`);

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      console.log(`\n[${i + 1}/${articles.length}] Processing: ${article.title}`);
      
      const success = await vectorizeArticle(article.id, article.title, article.content);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Add a small delay between requests to avoid rate limiting
      if (i < articles.length - 1) { // Don't delay after the last item
        await sleep(1000); // 1 second delay
      }
    }

    console.log('\n✨ Vectorization complete!');
    console.log(`📊 Results: ${successCount} succeeded, ${failureCount} failed`);
    
    if (failureCount > 0) {
      console.log('\nℹ️  Some articles failed to vectorize. Run the script again to retry failed articles.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Failed to complete vectorization:', error);
    process.exit(1);
  }
}

main(); 