import { supabase } from '../supabase';
import { KBArticle, CreateKBArticleInput, UpdateKBArticleInput } from '@/types/kb';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export const kbQueries = {
  // Get all published articles for an organization
  async getOrgArticles(organizationId: string) {
    return await supabase.rpc('get_kb_articles', {
      p_organization_id: organizationId
    });
  },

  // Get all draft articles for an organization
  async getDraftArticles(organizationId: string) {
    return await supabase.rpc('get_kb_draft_articles', {
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

  // Create a new article (defaults to draft status)
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
    return response.data[0];
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

  // Publish an article
  async publishArticle(articleId: string, organizationId: string, userId: string, title?: string, content?: string) {
    const { data, error } = await supabase.rpc('publish_kb_article', {
      p_article_id: articleId,
      p_organization_id: organizationId,
      p_user_id: userId,
      p_title: title,
      p_content: content
    });

    if (error) throw error;
    return data[0];
  },

  // Unpublish an article (revert to draft)
  async unpublishArticle(articleId: string, organizationId: string, userId: string) {
    const { data, error } = await supabase.rpc('unpublish_kb_article', {
      p_article_id: articleId,
      p_organization_id: organizationId,
      p_user_id: userId
    });

    if (error) throw error;
    return data[0];
  },

  // Delete an article (storage cleanup will happen via cascade)
  async deleteArticle(articleId: string, organizationId: string, userId: string) {
    // 1. Delete all files and folder from storage
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

    // 2. Delete the article using the RPC function
    const { data, error: deleteError } = await supabase.rpc('delete_kb_article', {
      p_article_id: articleId,
      p_organization_id: organizationId,
      p_user_id: userId
    });

    if (deleteError) throw deleteError;
    return data[0];
  }
};

// Subscription helper
export const subscriptionHelpers = {
  // Subscribe to KB article changes
  subscribeToKBArticles(organizationId: string, callback: (payload: RealtimePostgresChangesPayload<KBArticle>) => void) {
    console.log('Setting up KB article subscription for org:', organizationId);
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
        async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          console.log('Received KB article event:', payload.eventType, payload);
          if (payload.eventType === 'DELETE') {
            console.log('Processing DELETE event:', payload.old);
            // For deletes, transform the old record to match KBArticle type
            const oldRecord = payload.old as Partial<KBArticle>;
            callback({
              ...payload,
              old: oldRecord
            } as RealtimePostgresChangesPayload<KBArticle>);
            return;
          }

          // For inserts and updates, fetch the complete article data including author
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            console.log('Processing INSERT/UPDATE event:', payload.new);
            const { data: article } = await kbQueries.getArticleById(payload.new.id as string);
            if (article) {
              callback({
                ...payload,
                new: article
              } as RealtimePostgresChangesPayload<KBArticle>);
              return;
            }
          }
        }
      )
      .subscribe();
  }
}; 