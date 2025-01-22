'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { KBArticle, KBAttachment } from '@/types/kb';
import { kbQueries } from '@/utils/sql/kbQueries';
import ReactMarkdown from 'react-markdown';
import { getFileUrl, isImageFile, formatFileSize } from '@/utils/kb/attachments';
import AttachmentDisplay from '@/components/kb/AttachmentDisplay';

export default function ArticleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [article, setArticle] = useState<KBArticle | null>(null);
  const [attachments, setAttachments] = useState<KBAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadArticle() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth?type=admin');
          return;
        }

        // Get user's organization
        const { data: memberData, error: memberError } = await supabase
          .from('org_members')
          .select('organization_id')
          .eq('user_id', session.user.id)
          .in('role', ['admin', 'employee'])
          .single();

        if (memberError || !memberData) {
          router.push('/auth?type=admin');
          return;
        }

        // Get article
        const { data: articleData, error: articleError } = await kbQueries.getArticleById(
          params.id as string,
          memberData.organization_id
        );

        if (articleError) {
          throw articleError;
        }

        // Get attachments
        const { data: attachmentsData, error: attachmentsError } = await supabase
          .from('kb_attachments')
          .select(`
            id,
            article_id,
            file_name,
            file_type,
            file_size,
            storage_path,
            created_at,
            created_by,
            organization_id,
            users:kb_attachments_created_by_fkey (
              name
            )
          `)
          .eq('article_id', params.id);

        if (attachmentsError) {
          console.error('Error fetching attachments:', attachmentsError);
        }

        // Transform the data to match KBAttachment type
        const transformedAttachments: KBAttachment[] = (attachmentsData || []).map(attachment => ({
          ...attachment,
          author_name: attachment.users?.[0]?.name
        }));

        setArticle(articleData);
        setAttachments(transformedAttachments);
      } catch (error) {
        console.error('Error loading article:', error);
        setError('Failed to load article');
      } finally {
        setLoading(false);
      }
    }

    loadArticle();
  }, [router, params.id]);

  if (loading) {
    return <div className="text-center py-12">Loading article...</div>;
  }

  if (error || !article) {
    return (
      <div className="space-y-6 p-6">
        <div className="bg-red-50 p-4 rounded-md">
          <h3 className="text-sm font-medium text-red-800">{error || 'Article not found'}</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/kb"
          className="text-gray-600 hover:text-gray-900 inline-flex items-center"
        >
          ← Knowledge Base
        </Link>
        <Link
          href={`/dashboard/kb/${article.id}/edit`}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Edit Article
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-3xl font-semibold text-gray-900">{article.title}</h1>
          <div className="mt-2 text-sm text-gray-500 flex items-center gap-4">
            <span>By {article.author_name}</span>
            <span>•</span>
            <span>Last updated: {new Date(article.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="p-6">
          <div className="prose max-w-none">
            <ReactMarkdown
              components={{
                a: ({ href, children, ...props }) => {
                  const isStorageUrl = href && (
                    href.includes('storage.googleapis.com') || 
                    href.includes('supabase.co/storage')
                  );
                  // Check if this is a storage URL and not an image
                  if (isStorageUrl && !isImageFile(href)) {
                    return (
                      <span className="inline-block">
                        <AttachmentDisplay href={href} className="my-4" />
                      </span>
                    );
                  }
                  return (
                    <a href={href} {...props}>
                      {children}
                    </a>
                  );
                },
                // Handle images normally
                img: ({ src, alt }) => {
                  if (!src) return null;
                  return (
                    <img 
                      src={src} 
                      alt={alt} 
                      className="rounded-lg max-h-[500px] object-contain"
                    />
                  );
                },
                // Ensure paragraphs can contain blocks
                p: ({ ...props }) => (
                  <div className="mb-4" {...props} />
                )
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>
          
          {attachments.length > 0 && (
            <div className="mt-8 border-t pt-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Attachments</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={getFileUrl(attachment.storage_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors duration-150"
                  >
                    {isImageFile(attachment.file_type) ? (
                      <div className="w-12 h-12 flex-shrink-0">
                        <img
                          src={getFileUrl(attachment.storage_path)}
                          alt={attachment.file_name}
                          className="w-full h-full object-cover rounded"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded">
                        {attachment.file_type.startsWith('application/pdf') ? (
                          <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.363 2c4.155 0 2.637 6 2.637 6s6-1.65 6 2.457v11.543h-16v-20h7.363zm.826-2h-10.189v24h20v-14.386c0-2.391-6.648-9.614-9.811-9.614zm4.811 13h-2.628v3.686h.907v-1.472h1.49v-.732h-1.49v-.698h1.721v-.784zm-4.9 0h-1.599v3.686h1.599c.537 0 .961-.181 1.262-.535.555-.658.587-2.034-.062-2.692-.298-.3-.712-.459-1.2-.459zm-.692.783h.496c.473 0 .802.173.999.607.224.496.193 1.199-.127 1.592-.145.178-.42.275-.715.275h-.653v-2.474zm-2.74-.783h-1.668v3.686h.907v-1.277h.761c.619 0 1.064-.277 1.224-.763.095-.291.095-.597 0-.885-.16-.484-.606-.761-1.224-.761zm-.761.732h.546c.235 0 .467.028.576.228.067.123.067.366 0 .489-.109.199-.341.227-.576.227h-.546v-.944z"/>
                          </svg>
                        ) : attachment.file_type.startsWith('text/') ? (
                          <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8v-2zm0-4h8v2H8v-2z"/>
                          </svg>
                        ) : attachment.file_type.startsWith('application/json') ? (
                          <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3.5 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-4 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                          </svg>
                        ) : (
                          <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                          </svg>
                        )}
                      </div>
                    )}
                    <div className="ml-4 flex-grow min-w-0">
                      <div className="text-sm font-medium text-blue-600 hover:text-blue-700 truncate">
                        {attachment.file_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatFileSize(attachment.file_size)}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 