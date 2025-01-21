export type ArticleStatus = 'draft' | 'published';

export interface KBArticle {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  created_by: string;
  author_name?: string;
  status: ArticleStatus;
  published_at?: string;
}

export type CreateKBArticleInput = {
  title: string;
  content: string;
  organization_id: string;
  created_by: string;
};

export type UpdateKBArticleInput = {
  title?: string;
  content?: string;
};

export interface KBAttachment {
  id: string;
  article_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  created_by: string;
  organization_id: string;
  author_name?: string;
}

export interface CreateKBAttachmentInput {
  article_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  organization_id: string;
} 