'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { KBArticle } from '@/types/kb';
import { kbQueries } from '@/utils/sql/kbQueries';
import ReactMarkdown from 'react-markdown';
import { isImageFile } from '@/utils/kb/attachments';
import AttachmentDisplay from '@/components/kb/AttachmentDisplay';

export default function CustomerArticleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [article, setArticle] = useState<KBArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadArticle() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth?type=customer');
          return;
        }

        // Get organization ID from slug
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id')
          .eq('slug', params.orgSlug)
          .single();

        if (orgError || !orgData) {
          console.error('Organization not found:', orgError);
          router.push('/auth?type=customer');
          return;
        }

        // Verify user's membership in this organization
        const { data: memberData, error: memberError } = await supabase
          .from('org_members')
          .select('user_id')
          .eq('user_id', session.user.id)
          .eq('organization_id', orgData.id)
          .single();

        if (memberError || !memberData) {
          console.error('Not a member of this organization');
          router.push('/auth?type=customer');
          return;
        }

        // Get article
        const { data: articleData, error: articleError } = await kbQueries.getArticleById(
          params.id as string,
          orgData.id
        );

        if (articleError) {
          throw articleError;
        }

        setArticle(articleData);
      } catch (error) {
        console.error('Error loading article:', error);
        setError('Failed to load article');
      } finally {
        setLoading(false);
      }
    }

    loadArticle();
  }, [router, params.orgSlug, params.id]);

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
      <Link
        href={`/org/${params.orgSlug}/kb`}
        className="text-gray-600 hover:text-gray-900 inline-flex items-center"
      >
        ← Knowledge Base
      </Link>

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
        </div>
      </div>
    </div>
  );
} 