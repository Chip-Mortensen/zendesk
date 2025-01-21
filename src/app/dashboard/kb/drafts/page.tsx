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

        if (!orgMembership || orgMembership.role !== 'admin') {
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
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Draft Articles</h1>
        <Link
          href="/dashboard/kb/new"
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Create New Article
        </Link>
      </div>

      <div className="grid gap-4">
        {articles.map((article) => (
          <div
            key={article.id}
            className="border rounded-lg p-4 hover:border-blue-500 transition-colors"
          >
            <Link href={`/dashboard/kb/${article.id}/edit`} className="block">
              <h2 className="text-xl font-semibold mb-2">{article.title}</h2>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Created by {article.author_name}</span>
                <span>Last updated {new Date(article.updated_at).toLocaleDateString()}</span>
              </div>
            </Link>
          </div>
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
  );
} 