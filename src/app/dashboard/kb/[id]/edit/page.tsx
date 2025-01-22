'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { KBArticle, KBAttachment } from '@/types/kb';
import { kbQueries } from '@/utils/sql/kbQueries';
import { MarkdownEditor } from '@/components/markdown/MarkdownEditor';
import AttachmentPanel from '@/components/kb/AttachmentPanel';

export default function EditArticlePage() {
  const router = useRouter();
  const params = useParams();
  const [article, setArticle] = useState<KBArticle | null>(null);
  const [attachments, setAttachments] = useState<KBAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadArticle() {
      try {
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
          router.push('/login');
          return;
        }

        setUserId(session.data.session.user.id);

        const { data: orgMembership } = await supabase
          .from('org_members')
          .select('organization_id, role')
          .eq('user_id', session.data.session.user.id)
          .single();

        if (!orgMembership || !['admin', 'employee'].includes(orgMembership.role)) {
          router.push('/dashboard');
          return;
        }

        setOrganizationId(orgMembership.organization_id);

        const { data: articleData, error: articleError } = await kbQueries.getArticleById(
          params.id as string,
          orgMembership.organization_id
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
        setTitle(articleData.title);
        setContent(articleData.content);
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

  const handleSave = async () => {
    if (!article || !userId) return;

    try {
      setSaving(true);
      await kbQueries.updateArticle(article.id, { title, content }, userId);
      router.push('/dashboard/kb');
    } catch (err) {
      console.error('Error saving article:', err);
      setError('Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!article || !organizationId || !userId) return;

    try {
      setPublishing(true);
      await kbQueries.publishArticle(article.id, organizationId, userId, title, content);
      router.push('/dashboard/kb');
    } catch (err) {
      console.error('Error publishing article:', err);
      setError('Failed to publish article');
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!article || !organizationId || !userId) return;

    try {
      setPublishing(true);
      await kbQueries.unpublishArticle(article.id, organizationId, userId);
      router.push('/dashboard/kb/drafts');
    } catch (err) {
      console.error('Error unpublishing article:', err);
      setError('Failed to unpublish article');
    } finally {
      setPublishing(false);
    }
  };

  const handleAttachmentAdded = (attachment: KBAttachment) => {
    setAttachments(current => [...current, attachment]);
  };

  const handleAttachmentDeleted = (attachmentId: string) => {
    setAttachments(current => current.filter(a => a.id !== attachmentId));
  };

  const handleDelete = async () => {
    if (!article) return;
    
    setIsDeleting(true);
    setError(null);

    try {
      await kbQueries.deleteArticle(article.id, article.organization_id, userId!);
      router.push('/dashboard/kb');
    } catch (err) {
      console.error('Error deleting article:', err);
      setError('Failed to delete article');
      setIsDeleting(false);
    }
  };

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
    <div className="space-y-6 p-4">
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <nav className="flex" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-4">
                  <li>
                    <Link href="/dashboard/kb" className="text-sm font-medium text-gray-500 hover:text-gray-700">
                      Knowledge Base
                    </Link>
                  </li>
                  <li>
                    <div className="flex items-center">
                      <span className="text-gray-400 mx-2">/</span>
                      <Link
                        href={`/dashboard/kb/${article.id}`}
                        className="text-sm font-medium text-gray-500 hover:text-gray-700 truncate"
                      >
                        {article.title}
                      </Link>
                    </div>
                  </li>
                  <li>
                    <div className="flex items-center">
                      <span className="text-gray-400 mx-2">/</span>
                      <span className="text-sm font-medium text-gray-500 truncate">
                        Edit
                      </span>
                    </div>
                  </li>
                </ol>
              </nav>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => router.push('/dashboard/kb')}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                disabled={saving || publishing}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                disabled={saving || publishing}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={article.status === 'published' ? handleUnpublish : handlePublish}
                className={`px-4 py-2 rounded text-white disabled:opacity-50 ${
                  article.status === 'published'
                    ? 'bg-yellow-500 hover:bg-yellow-600'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
                disabled={saving || publishing}
              >
                {publishing
                  ? 'Processing...'
                  : article.status === 'published'
                  ? 'Unpublish'
                  : 'Publish'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Article title"
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
              Content
            </label>
            <div className="rounded-lg overflow-hidden border border-gray-300">
              <MarkdownEditor
                value={content}
                onChange={setContent}
                preview={false}
                height={500}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attachments
            </label>
            <AttachmentPanel
              articleId={article.id}
              organizationId={organizationId!}
              className="border rounded-lg p-4 bg-gray-50"
              attachments={attachments}
              onAttachmentAdded={handleAttachmentAdded}
              onAttachmentDeleted={handleAttachmentDeleted}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setShowDeleteModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          disabled={isDeleting}
        >
          {isDeleting ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Deleting...
            </>
          ) : (
            <>
              <svg className="-ml-0.5 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Article
            </>
          )}
        </button>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-50">
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <h3 className="text-base font-semibold leading-6 text-gray-900">
                      Delete Article
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete this article? This action cannot be undone.
                        All attachments will also be permanently deleted.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 