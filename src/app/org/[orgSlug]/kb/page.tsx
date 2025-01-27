'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { KBArticle } from '@/types/kb';
import { kbQueries } from '@/utils/sql/kbQueries';
import { useKBArticleSubscription } from '@/hooks/useKBArticleSubscription';
import { getPlainTextFromMarkdown } from '@/utils/markdown';
import { KBSearchBar } from '@/components/kb/KBSearchBar';

export default function CustomerKnowledgeBasePage() {
  const router = useRouter();
  const params = useParams();
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<KBArticle[] | null>(null);

  useEffect(() => {
    async function loadArticles() {
      try {
        const session = await supabase.auth.getSession();
        if (!session.data.session) {
          router.push('/login');
          return;
        }

        // Get organization ID from slug
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('slug', params.orgSlug)
          .single();

        if (!org) {
          setError('Organization not found');
          setLoading(false);
          return;
        }

        // Verify user is a member of this organization
        const { data: orgMembership } = await supabase
          .from('org_members')
          .select('organization_id, role')
          .eq('user_id', session.data.session.user.id)
          .single();

        if (!orgMembership) {
          router.push('/dashboard');
          return;
        }

        setOrganizationId(org.id);

        const { data: articles, error } = await kbQueries.getOrgArticles(org.id);
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
  }, [router, params.orgSlug]);

  // Set up real-time subscription for published articles only
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

  const handleSearch = useCallback(async (query: string) => {
    if (!organizationId) return;
    
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch('/api/kb/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, organizationId }),
      });

      if (!response.ok) throw new Error('Search failed');

      const { articles: results } = await response.json();
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
      // Keep showing existing articles on error
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }, [organizationId]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  const displayedArticles = searchResults || articles;

  return (
    <div className="space-y-6 p-4">
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Knowledge Base</h1>
              <p className="mt-1 text-sm text-gray-500">Find answers to common questions and learn more about our services.</p>
            </div>
            <div className="bg-gray-50 py-4 px-6 rounded-lg">
              <KBSearchBar 
                onSearch={handleSearch} 
                isSearching={isSearching}
              />
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedArticles.map((article) => (
              <Link
                key={article.id}
                href={`/org/${params.orgSlug}/kb/${article.id}`}
                className="group block bg-white border rounded-lg hover:border-blue-500 hover:shadow-md transition-all duration-200 h-full"
              >
                <div className="p-6 flex flex-col h-full">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 mb-2">
                      {article.title}
                    </h2>
                    <p className="text-gray-600 text-sm line-clamp-3">
                      {getPlainTextFromMarkdown(article.content)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t mt-4">
                    <div className="flex items-center">
                      <span className="inline-block w-6 h-6 bg-gray-100 rounded-full mr-2 flex items-center justify-center">
                        {article.author_name?.charAt(0) || 'A'}
                      </span>
                      <span>{article.author_name}</span>
                    </div>
                    <span>{new Date(article.published_at || article.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}

            {displayedArticles.length === 0 && (
              <div className="col-span-full">
                <p className="text-gray-500 text-center py-8">
                  {searchResults ? 'No matching articles found.' : 'No published articles available.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 