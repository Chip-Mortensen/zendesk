import { supabase } from '../supabase';
import { KBArticle, CreateKBArticleInput, UpdateKBArticleInput } from '@/types/kb';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export const kbQueries = {
  // Get all articles for an organization
  async getOrgArticles(organizationId: string) {
    return await supabase.rpc('get_kb_articles', {
      p_organization_id: organizationId
    });
  },

  // Get a single article
  async getArticleById(articleId: string, organizationId?: string) {
    const query = supabase
      .from('kb_articles')
      .select(`
        *,
        users!kb_articles_created_by_fkey (
          name
        )
      `)
      .eq('id', articleId);
    
    if (organizationId) {
      query.eq('organization_id', organizationId);
    }

    const { data, error } = await query.single();

    if (error) {
      throw error;
    }

    // Transform the data to include author_name
    return {
      data: {
        ...data,
        author_name: data.users?.name
      },
      error: null
    };
  },

  // Create a new article
  async createArticle(article: CreateKBArticleInput) {
    console.log('kbQueries.createArticle called with:', article);
    
    const response = await supabase.rpc('create_kb_article', {
      p_title: article.title,
      p_content: article.content,
      p_organization_id: article.organization_id,
      p_user_id: article.created_by
    });
    
    console.log('Raw response from create_kb_article:', response);

    if (response.error) {
      console.error('Error in createArticle:', response.error);
      throw response.error;
    }

    console.log('Processed data from create_kb_article:', response.data);
    return response.data;
  },

  // Update an article
  async updateArticle(articleId: string, updates: UpdateKBArticleInput, userId: string) {
    const { data, error } = await supabase.rpc('update_kb_article', {
      p_article_id: articleId,
      p_title: updates.title,
      p_content: updates.content,
      p_user_id: userId
    });

    if (error) throw error;
    return data;
  },

  // Delete an article (storage cleanup will happen via cascade)
  async deleteArticle(articleId: string, organizationId?: string) {
    // 1. Delete all files and folder from storage
    if (organizationId) {
      // First list all files in the article folder
      const { data: files, error: listError } = await supabase.storage
        .from('kb_attachments')
        .list(`${organizationId}/${articleId}`);

      if (listError) {
        console.error('Error listing files:', listError);
      } else {
        // Delete all files found (if any)
        if (files && files.length > 0) {
          const filePaths = files.map(file => `${organizationId}/${articleId}/${file.name}`);
          const { error: filesError } = await supabase.storage
            .from('kb_attachments')
            .remove(filePaths);

          if (filesError) {
            console.error('Error deleting files:', filesError);
          }
        }

        // Delete the folder itself
        const { error: folderError } = await supabase.storage
          .from('kb_attachments')
          .remove([`${organizationId}/${articleId}/`]);

        if (folderError) {
          console.error('Error deleting folder:', folderError);
        }
      }
    }

    // 2. Delete the article (attachments will be deleted via cascade)
    const query = supabase
      .from('kb_articles')
      .delete()
      .eq('id', articleId);
    
    if (organizationId) {
      query.eq('organization_id', organizationId);
    }

    const { error: deleteError } = await query;
    if (deleteError) throw deleteError;

    return { success: true };
  }
};

// Subscription helper
export const subscriptionHelpers = {
  // Subscribe to KB article changes
  subscribeToKBArticles(organizationId: string, callback: (payload: RealtimePostgresChangesPayload<KBArticle>) => void) {
    return supabase
      .channel(`kb-articles-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kb_articles',
          filter: `organization_id=eq.${organizationId}`
        },
        callback
      )
      .subscribe();
  }
}; 