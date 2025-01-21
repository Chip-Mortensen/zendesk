'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { KBArticle } from '@/types/kb';
import { kbQueries, subscriptionHelpers } from '@/utils/sql/kbQueries';
import { getPlainTextFromMarkdown } from '@/utils/markdown';

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    async function loadUserAndArticles() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error('No session found');
          router.push('/auth?type=admin');
          return;
        }

        // Get user's organization
        const { data: memberData, error: memberError } = await supabase
          .from('org_members')
          .select('organization_id')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .single();

        if (memberError || !memberData) {
          console.error('Error fetching member data:', memberError);
          router.push('/auth?type=admin');
          return;
        }

        setOrganizationId(memberData.organization_id);

        // Get articles for this organization
        const { data: articlesData, error: articlesError } = await kbQueries.getOrgArticles(memberData.organization_id);

        if (articlesError) {
          console.error('Error fetching articles:', articlesError);
          return;
        }

        setArticles(articlesData || []);
      } catch (error) {
        console.error('Error in loadUserAndArticles:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUserAndArticles();
  }, [router]);

  // Set up realtime subscription
  useEffect(() => {
    if (!organizationId) return;

    const subscription = subscriptionHelpers.subscribeToKBArticles(
      organizationId,
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setArticles(current => [payload.new as KBArticle, ...current]);
        } else if (payload.eventType === 'DELETE') {
          setArticles(current => current.filter(article => article.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setArticles(current =>
            current.map(article =>
              article.id === payload.new.id ? { ...article, ...payload.new } : article
            )
          );
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [organizationId]);

  if (loading) {
    return <div className="text-center py-12">Loading knowledge base...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Knowledge Base</h1>
        <Link
          href="/dashboard/kb/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Create Article
        </Link>
      </div>

      {articles.length === 0 ? (
        <div className="text-center py-12 bg-white shadow rounded-lg">
          <p className="text-gray-500">No articles found. Create your first article to get started.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/dashboard/kb/${article.id}`}
              className="block bg-white shadow rounded-lg hover:shadow-md transition-shadow h-full"
            >
              <div className="p-6 flex flex-col h-full">
                <div className="flex-grow">
                  <h2 className="text-lg font-medium text-gray-900 mb-2">{article.title}</h2>
                  <p className="text-gray-500 text-sm line-clamp-3">
                    {getPlainTextFromMarkdown(article.content)}
                  </p>
                </div>
                <div className="mt-4 flex justify-between items-center text-xs text-gray-400">
                  <span>{article.author_name}</span>
                  <span>{new Date(article.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
