'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';

interface UserData {
  name: string;
  email: string;
  organization: {
    name: string;
    slug: string;
  };
}

export default function CustomerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgSlug, setOrgSlug] = useState<string>('');
  const [pendingSlugUpdate, setPendingSlugUpdate] = useState<string | null>(null);

  const getUserData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No session found, redirecting to auth');
        router.push('/auth?type=customer');
        return;
      }

      console.log('Fetching org member data for:', {
        userId: session.user.id,
        orgSlug
      });

      // First get the organization ID from the slug
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('slug', orgSlug)
        .single();

      if (orgError || !orgData) {
        console.error('Organization not found:', orgError);
        router.push('/auth?type=customer');
        return;
      }

      // Then get the membership with this org
      const { data: memberData, error: memberError } = await supabase
        .from('org_members')
        .select('user_id, organization_id, role')
        .eq('user_id', session.user.id)
        .eq('organization_id', orgData.id)
        .single();

      console.log('Member data response:', { memberData, memberError });

      if (memberError) {
        console.error('Error fetching user data:', memberError);
        router.push('/auth?type=customer');
        return;
      }

      // Check if user is a customer - admins and employees should go to dashboard
      if (!memberData || (memberData.role !== 'customer')) {
        console.log('Redirecting admin/employee to dashboard');
        router.push('/dashboard');
        return;
      }

      setUserData({
        name: session.user.user_metadata.name || 'Unknown User',
        email: session.user.email || '',
        organization: {
          name: orgData.name,
          slug: orgData.slug,
        },
      });

      // Set up real-time subscription for organization changes
      const channel = supabase.channel(`org-changes-${orgData.id}`);
      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'organizations',
            filter: `id=eq.${orgData.id}`,
          },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              console.log('Organization updated:', payload);
              // First verify the new organization exists and is accessible
              supabase
                .from('organizations')
                .select('id, name, slug')
                .eq('slug', payload.new.slug)
                .single()
                .then(({ data: newOrgData, error: newOrgError }) => {
                  if (!newOrgError && newOrgData) {
                    // Set the pending slug update
                    if (payload.new.slug !== userData?.organization.slug) {
                      setPendingSlugUpdate(payload.new.slug);
                    }
                    setUserData((prev) => ({
                      ...prev!,
                      organization: {
                        ...prev!.organization,
                        name: payload.new.name,
                        slug: payload.new.slug,
                      },
                    }));
                  } else {
                    console.error('Could not verify new organization slug:', newOrgError);
                    // Keep the old slug but update the name
                    setUserData((prev) => ({
                      ...prev!,
                      organization: {
                        ...prev!.organization,
                        name: payload.new.name,
                      },
                    }));
                  }
                });
            }
          }
        )
        .subscribe();

      // Clean up subscription
      return () => {
        channel.unsubscribe();
      };

    } catch (error) {
      console.error('Error in getUserData:', error);
      router.push('/auth?type=customer');
    } finally {
      setLoading(false);
    }
  }, [router, orgSlug, userData?.organization.slug]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/auth?type=customer');
  }, [router]);

  useEffect(() => {
    const slug = params?.orgSlug;
    if (typeof slug === 'string') {
      setOrgSlug(slug);
    }
  }, [params?.orgSlug]);

  useEffect(() => {
    if (pendingSlugUpdate && userData?.organization.slug && pendingSlugUpdate !== userData.organization.slug) {
      const newPath = pathname.replace(`/org/${userData.organization.slug}`, `/org/${pendingSlugUpdate}`);
      router.replace(newPath);
      setPendingSlugUpdate(null);
    }
  }, [pendingSlugUpdate, userData?.organization.slug, pathname, router]);

  useEffect(() => {
    if (!orgSlug) return;
    getUserData();
  }, [orgSlug, getUserData]);

  if (loading || !orgSlug) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const navigation = [
    { name: 'My Tickets', href: `/org/${userData?.organization.slug}/tickets` },
    { name: 'Knowledge Base', href: `/org/${userData?.organization.slug}/kb` },
    { name: 'Chat', href: `/org/${userData?.organization.slug}/chat` },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top navigation */}
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <a 
                  href={`/org/${userData?.organization.slug}`}
                  className="text-xl font-bold text-gray-900 hover:text-gray-700 transition-colors"
                >
                  {userData?.organization.name}
                </a>
              </div>
              <div className="ml-6 flex space-x-8">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <a
                      key={item.name}
                      href={item.href}
                      className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                        isActive
                          ? 'border-blue-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      {item.name}
                    </a>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="relative ml-3">
                  <div className="flex items-center">
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-700">{userData?.name}</div>
                      <div className="text-xs text-gray-500">{userData?.email}</div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="ml-4 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
} 