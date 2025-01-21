'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { KBArticle } from '@/types/kb';
import { kbQueries } from '@/utils/sql/kbQueries';
import { useKBArticleSubscription } from '@/hooks/useKBArticleSubscription';
import { getPlainTextFromMarkdown } from '@/utils/markdown';

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

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

        if (!orgMembership) {
          router.push('/dashboard');
          return;
        }

        setOrganizationId(orgMembership.organization_id);
        setIsAdmin(orgMembership.role === 'admin');

        const { data: articles, error } = await kbQueries.getOrgArticles(orgMembership.organization_id);
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
    if (payload.eventType === 'INSERT' && payload.new.status === 'published') {
      setArticles(current => [payload.new as KBArticle, ...current]);
    } else if (payload.eventType === 'DELETE') {
      setArticles(current => current.filter(article => article.id !== payload.old.id));
    } else if (payload.eventType === 'UPDATE') {
      if (payload.new.status === 'published') {
        setArticles(current => {
          const exists = current.some(a => a.id === payload.new.id);
          if (exists) {
            return current.map(article => 
              article.id === payload.new.id ? { ...payload.new as KBArticle } : article
            );
          } else {
            return [payload.new as KBArticle, ...current];
          }
        });
      } else {
        // Remove articles that are no longer published
        setArticles(current => current.filter(article => article.id !== payload.new.id));
      }
    }
  });

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Knowledge Base</h1>
        <div className="flex gap-4">
          {isAdmin && (
            <Link
              href="/dashboard/kb/drafts"
              className="border border-gray-300 hover:border-gray-400 px-4 py-2 rounded text-gray-700 hover:text-gray-900"
            >
              View Drafts
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/dashboard/kb/new"
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Create New Article
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <div
            key={article.id}
            className="border rounded-lg p-6 hover:border-blue-500 transition-colors flex flex-col justify-between h-full"
          >
            <div>
              <Link href={`/dashboard/kb/${article.id}`}>
                <h2 className="text-xl font-semibold mb-3 hover:text-blue-600 transition-colors">{article.title}</h2>
              </Link>
              <p className="text-gray-600 mb-4 line-clamp-3">
                {getPlainTextFromMarkdown(article.content)}
              </p>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-500 pt-4 border-t">
              <span>By {article.author_name}</span>
              <span>Published {new Date(article.published_at || article.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}

        {articles.length === 0 && (
          <div className="col-span-full">
            <p className="text-gray-500 text-center py-8">
              No published articles yet.
              {isAdmin && " Click 'Create New Article' to get started."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
