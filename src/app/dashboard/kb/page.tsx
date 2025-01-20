'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  organization_id: string;
}

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

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

        // Get articles for this organization
        const { data: articlesData, error: articlesError } = await supabase
          .from('kb_articles')
          .select('*')
          .eq('organization_id', memberData.organization_id)
          .order('created_at', { ascending: false });

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
              className="block bg-white shadow rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="text-sm text-blue-600 mb-2">{article.category}</div>
                <h2 className="text-lg font-medium text-gray-900 mb-2">{article.title}</h2>
                <p className="text-gray-500 text-sm line-clamp-3">{article.content}</p>
                <div className="mt-4 text-xs text-gray-400">
                  {new Date(article.created_at).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
