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
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <Link
          href="/dashboard/kb"
          className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Knowledge Base
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-8">Create New Article</h1>

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
  );
} 