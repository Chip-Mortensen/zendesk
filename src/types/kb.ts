export interface KBArticle {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  author_name?: string;
  attachments?: KBAttachment[];
}

export type CreateKBArticleInput = Omit<KBArticle, 'id' | 'created_at' | 'updated_at' | 'author_name'> & {
  temp_article_id?: string;
};
export type UpdateKBArticleInput = Pick<KBArticle, 'title' | 'content'>;

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