import { supabase } from '@/utils/supabase';
import { KBAttachment, CreateKBAttachmentInput } from '@/types/kb';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'text/plain', 'text/markdown'];

export const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];

export async function uploadFile(
  file: File,
  articleId: string,
  organizationId: string
): Promise<KBAttachment | null> {
  try {
    // Validate file
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      throw new Error('File type not supported');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds limit');
    }

    // Generate storage path
    const fileExt = file.name.split('.').pop();
    const fileName = `${articleId}-${Date.now()}.${fileExt}`;
    const storagePath = `${organizationId}/${articleId}/${fileName}`;

    // Upload to storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from('kb_attachments')
      .upload(storagePath, file);

    if (storageError) throw storageError;

    // Create attachment record
    const attachmentData: CreateKBAttachmentInput = {
      article_id: articleId,
      organization_id: organizationId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
    };

    const { data: attachment, error: dbError } = await supabase
      .from('kb_attachments')
      .insert(attachmentData)
      .select(`
        *,
        users!kb_attachments_created_by_fkey (
          name
        )
      `)
      .single();

    if (dbError) throw dbError;

    // Transform the response to match KBAttachment type
    const transformedAttachment: KBAttachment = {
      ...attachment,
      author_name: attachment.users?.name
    }

    return transformedAttachment;
  } catch (error) {
    console.error('Error uploading file:', error);
    return null;
  }
}

export async function deleteAttachment(attachment: KBAttachment): Promise<boolean> {
  try {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('kb_attachments')
      .remove([attachment.storage_path]);

    if (storageError) throw storageError;

    // Delete from database
    const { error: dbError } = await supabase
      .from('kb_attachments')
      .delete()
      .eq('id', attachment.id);

    if (dbError) throw dbError;

    return true;
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return false;
  }
}

export function getFileUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from('kb_attachments')
    .getPublicUrl(storagePath);
  
  return data.publicUrl;
}

export function isImageFile(fileType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(fileType);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 