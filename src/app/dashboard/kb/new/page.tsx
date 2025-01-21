'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { kbQueries } from '@/utils/sql/kbQueries';
import { KBAttachment } from '@/types/kb';
import { MarkdownEditor } from '@/components/markdown/MarkdownEditor';
import AttachmentPanel from '@/components/kb/AttachmentPanel';

interface PendingAttachment {
  file: File;
  name: string;
  type: string;
  size: number;
}

export default function NewKBArticlePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Load user's organization
  useEffect(() => {
    async function loadOrganization() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth?type=admin');
          return;
        }

        setUserId(session.user.id);

        const { data: memberData, error: memberError } = await supabase
          .from('org_members')
          .select('organization_id')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .single();

        if (memberError || !memberData) {
          router.push('/auth?type=admin');
          return;
        }

        setOrganizationId(memberData.organization_id);
      } catch (error) {
        console.error('Error loading organization:', error);
      }
    }

    loadOrganization();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !userId) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Creating article with data:', { title, content, organizationId, userId });
      
      // 1. Create the article first
      const articles = await kbQueries.createArticle({
        title,
        content,
        organization_id: organizationId,
        created_by: userId
      });
      
      console.log('Create article response:', articles);

      // The stored procedure returns an array with one item
      const article = articles?.[0];
      console.log('First article from response:', article);
      
      if (!article?.id) throw new Error('No article ID returned');
      console.log('Successfully got article ID:', article.id);

      // 2. Upload any pending attachments
      console.log('Starting attachment uploads for article:', article.id);
      for (const pending of pendingAttachments) {
        const storagePath = `${organizationId}/${article.id}/${article.id}-${Date.now()}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('kb_attachments')
          .upload(storagePath, pending.file);

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          continue;
        }

        // Create attachment record
        const { error: attachError } = await supabase
          .from('kb_attachments')
          .insert({
            article_id: article.id,
            organization_id: organizationId,
            file_name: pending.name,
            file_type: pending.type,
            file_size: pending.size,
            storage_path: storagePath,
            created_by: userId
          });

        if (attachError) {
          console.error('Error creating attachment record:', attachError);
        }
      }

      router.push('/dashboard/kb');
    } catch (err) {
      console.error('Error creating article:', err);
      setError('Failed to create article');
      setLoading(false);
    }
  };

  const handleAttachmentAdded = (file: File) => {
    setPendingAttachments(current => [...current, {
      file,
      name: file.name,
      type: file.type,
      size: file.size
    }]);
  };

  const handleAttachmentDeleted = (fileName: string) => {
    setPendingAttachments(current => current.filter(a => a.name !== fileName));
  };

  if (!organizationId) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <nav className="flex mb-4" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-4">
              <li>
                <Link href="/dashboard/kb" className="text-sm font-medium text-gray-500 hover:text-gray-700">
                  Knowledge Base
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <span className="text-gray-400 mx-2">/</span>
                  <span className="text-sm font-medium text-gray-500 truncate">
                    New Article
                  </span>
                </div>
              </li>
            </ol>
          </nav>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="title"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700">
              Content
            </label>
            <div className="mt-1">
              <MarkdownEditor
                value={content}
                onChange={setContent}
                height={500}
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Attachments</h3>
            <div className="bg-gray-50 rounded-lg">
              <AttachmentPanel
                isPending={true}
                pendingFiles={pendingAttachments}
                onPendingFileAdded={handleAttachmentAdded}
                onPendingFileDeleted={handleAttachmentDeleted}
                className="flex-grow"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <Link
            href="/dashboard/kb"
            className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {loading ? 'Creating...' : 'Create Article'}
          </button>
        </div>
      </form>
    </div>
  );
} 