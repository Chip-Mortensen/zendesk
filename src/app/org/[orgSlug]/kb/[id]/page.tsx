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
    <div className="space-y-6 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-4">
              <li>
                <Link 
                  href={`/org/${params.orgSlug}/kb`} 
                  className="text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Knowledge Base
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <span className="text-gray-400 mx-2">/</span>
                  <span className="text-sm font-medium text-gray-500 truncate">
                    {article.title}
                  </span>
                </div>
              </li>
            </ol>
          </nav>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">{article.title}</h1>
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
            <div className="mt-8 text-sm text-gray-500">
              <div>Last updated: {new Date(article.updated_at).toLocaleString()}</div>
              <div>Author: {article.author_name}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 