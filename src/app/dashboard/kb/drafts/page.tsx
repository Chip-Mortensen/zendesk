'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { KBArticle } from '@/types/kb';
import { kbQueries } from '@/utils/sql/kbQueries';
import { useKBArticleSubscription } from '@/hooks/useKBArticleSubscription';

export default function DraftArticlesPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    async function loadArticles() {
      try {
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
          router.push('/login');
          return;
        }

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

        const { data: articles, error } = await kbQueries.getDraftArticles(orgMembership.organization_id);
        if (error) throw error;

        setArticles(articles);
        setLoading(false);
      } catch (err) {
        console.error('Error loading articles:', err);
        setError('Failed to load articles');
        setLoading(false);
      }
    }

    loadArticles();
  }, [router]);

  // Set up real-time subscription
  useKBArticleSubscription(organizationId, (payload) => {
    if (payload.eventType === 'INSERT' && payload.new.status === 'draft') {
      setArticles(current => [payload.new as KBArticle, ...current]);
    } else if (payload.eventType === 'DELETE') {
      setArticles(current => current.filter(article => article.id !== payload.old.id));
    } else if (payload.eventType === 'UPDATE') {
      setArticles(current => current.map(article => 
        article.id === payload.new.id ? { ...payload.new as KBArticle } : article
      ));
    }
  });

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="space-y-6 p-4">
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Draft Articles</h1>
              <p className="mt-1 text-sm text-gray-500">Manage your unpublished knowledge base articles.</p>
            </div>
            <Link
              href="/dashboard/kb/new"
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Create New Article
            </Link>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/dashboard/kb/${article.id}/edit`}
                className="group block bg-white border rounded-lg hover:border-blue-500 hover:shadow-md transition-all duration-200 h-full"
              >
                <div className="p-6 flex flex-col h-full">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 mb-2">
                      {article.title}
                    </h2>
                    <p className="text-gray-600 text-sm line-clamp-3">
                      {article.content}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t mt-4">
                    <div className="flex items-center">
                      <span className="inline-block w-6 h-6 bg-gray-100 rounded-full mr-2 flex items-center justify-center">
                        {article.author_name?.charAt(0) || 'A'}
                      </span>
                      <span>{article.author_name}</span>
                    </div>
                    <span>Last updated {new Date(article.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}

            {articles.length === 0 && (
              <div className="col-span-full">
                <p className="text-gray-500 text-center py-8">
                  No draft articles yet. Click &quot;Create New Article&quot; to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 