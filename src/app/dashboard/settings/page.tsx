'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface OrgData {
  id: string;
  name: string;
  slug: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orgData, setOrgData] = useState<OrgData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: ''
  });

  useEffect(() => {
    async function checkAccess() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth?type=admin');
          return;
        }

        // Check if user is admin
        const { data: memberData, error: memberError } = await supabase
          .from('org_members')
          .select('role, organization_id')
          .eq('user_id', session.user.id)
          .single();

        if (memberError || !memberData || memberData.role !== 'admin') {
          console.log('Access denied: Settings page is admin-only');
          router.push('/dashboard');
          return;
        }

        // Get organization data
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id, name, slug')
          .eq('id', memberData.organization_id)
          .single();

        if (orgError || !orgData) {
          console.error('Error fetching organization:', orgError);
          return;
        }

        setOrgData(orgData);
        setFormData({
          name: orgData.name,
          slug: orgData.slug
        });
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking access:', error);
        router.push('/dashboard');
      }
    }

    checkAccess();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    // Check if slug is valid
    const { data: slugCheck } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', formData.slug)
      .neq('id', orgData?.id)
      .single();

    if (slugCheck) {
      setError('This slug is already taken');
      setIsSaving(false);
      return;
    }

    try {
      // Validate slug format
      if (!/^[a-z0-9-]+$/.test(formData.slug)) {
        setError('Slug can only contain lowercase letters, numbers, and hyphens');
        setIsSaving(false);
        return;
      }

      // Update organization
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          name: formData.name,
          slug: formData.slug,
          updated_at: new Date().toISOString()
        })
        .eq('id', orgData?.id);

      if (updateError) throw updateError;

      setSuccess('Organization settings updated successfully');
      // Update local org data
      setOrgData(prev => prev ? { ...prev, ...formData } : null);
    } catch (err) {
      console.error('Error updating organization:', err);
      setError('Failed to update organization settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Organization Settings</h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 text-green-700 p-3 rounded">
              {success}
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
                Organization Slug
              </label>
              <input
                type="text"
                id="slug"
                value={formData.slug}
                onChange={(e) => {
                  // Only allow lowercase letters, numbers, and hyphens
                  const newSlug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                  setFormData(prev => ({ ...prev, slug: newSlug }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Only lowercase letters, numbers, and hyphens.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 