'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { KBAttachment } from '@/types/kb';
import { supabase } from '@/utils/supabase';
import { isImageFile, getFileUrl, formatFileSize } from '@/utils/kb/attachments';

interface PendingAttachment {
  file: File;
  name: string;
  type: string;
  size: number;
}

interface AttachmentPanelProps {
  articleId?: string;
  organizationId?: string;
  attachments?: KBAttachment[];
  onAttachmentAdded?: (attachment: KBAttachment) => void;
  onAttachmentDeleted?: (attachmentId: string) => void;
  isPending?: boolean;
  pendingFiles?: PendingAttachment[];
  onPendingFileAdded?: (file: File) => void;
  onPendingFileDeleted?: (fileName: string) => void;
  className?: string;
}

export default function AttachmentPanel({
  articleId,
  organizationId,
  attachments = [],
  onAttachmentAdded,
  onAttachmentDeleted,
  isPending = false,
  pendingFiles = [],
  onPendingFileAdded,
  onPendingFileDeleted,
  className = ''
}: AttachmentPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (isPending) {
      // For new articles, just add to pending files
      acceptedFiles.forEach(file => {
        onPendingFileAdded?.(file);
      });
      return;
    }

    // For existing articles, upload immediately
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !articleId || !organizationId) return;

    for (const file of acceptedFiles) {
      const storagePath = `kb_attachments/${organizationId}/${articleId}/${articleId}-${Date.now()}-${file.name}`;
      
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('kb_attachments')
        .upload(storagePath, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        continue;
      }

      // Create attachment record
      const { data, error } = await supabase
        .from('kb_attachments')
        .insert({
          article_id: articleId,
          organization_id: organizationId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
          created_by: session.user.id
        })
        .select(`
          *,
          users!kb_attachments_created_by_fkey (
            name
          )
        `)
        .single();

      if (error) {
        console.error('Error creating attachment record:', error);
        continue;
      }

      // Transform the data to include author_name
      const attachment: KBAttachment = {
        ...data,
        author_name: data.users?.name
      };

      onAttachmentAdded?.(attachment);
    }
  }, [articleId, organizationId, onAttachmentAdded, isPending, onPendingFileAdded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleDelete = async (attachmentId: string, storagePath: string) => {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('kb_attachments')
      .remove([storagePath]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
      return;
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('kb_attachments')
      .delete()
      .eq('id', attachmentId);

    if (dbError) {
      console.error('Error deleting attachment record:', dbError);
      return;
    }

    onAttachmentDeleted?.(attachmentId);
  };

  const handleCopy = async (attachment: KBAttachment) => {
    const fileUrl = getFileUrl(attachment.storage_path);
    const markdown = isImageFile(attachment.file_type)
      ? `![${attachment.file_name}](${fileUrl})`
      : `[${attachment.file_name}](${fileUrl})`;
    
    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedId(attachment.id);
      setTimeout(() => setCopiedId(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors duration-150 ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-gray-600">
          {isDragActive
            ? 'Drop the files here...'
            : 'Drag and drop files here, or click to select files'}
        </p>
      </div>

      {/* Show pending files for new articles */}
      {isPending && pendingFiles.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-4">
          {pendingFiles.map((file) => (
            <div
              key={file.name}
              className="flex items-center p-3 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-150 w-64"
            >
              {isImageFile(file.type) ? (
                <div className="w-10 h-10 flex-shrink-0">
                  <img
                    src={URL.createObjectURL(file.file)}
                    alt={file.name}
                    className="w-full h-full object-cover rounded"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <div className="ml-3 flex-grow">
                <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                <div className="text-sm text-gray-500">{formatFileSize(file.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => onPendingFileDeleted?.(file.name)}
                className="p-1 text-gray-400 hover:text-red-500"
                title="Remove file"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Show saved attachments for existing articles */}
      {!isPending && attachments.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-4">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center p-3 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-150 w-64"
            >
              {isImageFile(attachment.file_type) ? (
                <div className="w-10 h-10 flex-shrink-0">
                  <img
                    src={getFileUrl(attachment.storage_path)}
                    alt={attachment.file_name}
                    className="w-full h-full object-cover rounded"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <div className="ml-3 flex-grow">
                <div className="text-sm font-medium text-gray-900 truncate">{attachment.file_name}</div>
                <div className="text-sm text-gray-500">{formatFileSize(attachment.file_size)}</div>
                <div className="flex items-center mt-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(attachment)}
                    className={`p-1 transition-colors duration-150 ${
                      copiedId === attachment.id 
                        ? 'text-green-500' 
                        : 'text-gray-400 hover:text-blue-500'
                    }`}
                    title="Copy markdown to clipboard"
                  >
                    {copiedId === attachment.id ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    )}
                    {copiedId === attachment.id && (
                      <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-75">
                        Copied!
                      </span>
                    )}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(attachment.id, attachment.storage_path)}
                className="p-1 text-gray-400 hover:text-red-500"
                title="Delete attachment"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 