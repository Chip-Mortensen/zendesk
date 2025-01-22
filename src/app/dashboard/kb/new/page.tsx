'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { kbQueries } from '@/utils/sql/kbQueries';

export default function NewKBArticlePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setCreating(true);

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

      const article = await kbQueries.createArticle({
        title: title.trim(),
        content: '',
        organization_id: orgMembership.organization_id,
        created_by: session.data.session.user.id
      });

      router.push(`/dashboard/kb/${article.id}/edit`);
    } catch (err) {
      console.error('Error creating article:', err);
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <button
        onClick={() => router.push('/dashboard/kb')}
        className="text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center"
      >
        ← Back to Knowledge Base
      </button>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900">Create New Article</h1>
          <p className="mt-1 text-sm text-gray-500">Start writing a new knowledge base article.</p>
        </div>

        <div className="p-6">
          <form onSubmit={handleCreate} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter article title"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Link
                href="/dashboard/kb"
                className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Article'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 