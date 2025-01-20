'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';

interface Organization {
  name: string;
}

interface MemberData {
  role: string;
  organizations: Organization[];
}

interface UserData {
  name: string;
  email: string;
  role: string;
  organization: {
    name: string;
  };
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadUserData() {
      try {
        console.log('Dashboard - Checking session');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        console.log('Dashboard - Session check result:', { 
          hasSession: !!session,
          sessionError 
        });

        if (!session && mounted) {
          console.log('Dashboard - No session, redirecting to auth');
          router.push('/auth?type=admin');
          return;
        }

        if (!session) return;

        // Get user's organization membership
        console.log('Dashboard - Fetching admin membership for user:', session.user.id);
        const { data: memberData, error: memberError } = await supabase
          .from('org_members')
          .select('organization_id, role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .single();

        console.log('Dashboard - Membership check result:', {
          memberData,
          memberError
        });

        if ((memberError || !memberData) && mounted) {
          console.error('Dashboard - Error fetching admin data:', memberError);
          router.push('/auth?type=admin');
          return;
        }

        if (!memberData) return;

        // Get organization details
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', memberData.organization_id)
          .single();

        if (orgError || !orgData) {
          console.error('Dashboard - Error fetching organization:', orgError);
          router.push('/auth?type=admin');
          return;
        }

        if (mounted) {
          console.log('Dashboard - Setting user data with member data:', memberData);
          const userData = {
            name: session.user.user_metadata.name || 'Admin User',
            email: session.user.email || '',
            role: memberData.role,
            organization: {
              name: orgData.name,
            },
          };
          console.log('Dashboard - Final user data:', userData);
          setUserData(userData);
        }
      } catch (error) {
        console.error('Dashboard - Error in loadUserData:', error);
        if (mounted) {
          router.push('/auth?type=admin');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadUserData();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Dashboard - Auth state changed:', event, !!session);
      if (event === 'SIGNED_OUT') {
        router.push('/auth?type=admin');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const navigation = [
    { name: 'Tickets', href: '/dashboard/tickets' },
    { name: 'Knowledge Base', href: '/dashboard/kb' },
    { name: 'Chat', href: '/dashboard/chat' },
    { name: 'Customers', href: '/dashboard/customers' },
    { name: 'Settings', href: '/dashboard/settings' },
  ];

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/auth?type=admin');
    } catch (error) {
      console.error('Error signing out:', error);
      router.push('/auth?type=admin');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!userData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                  {userData.organization.name}
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      pathname === item.href
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <div className="font-medium text-gray-900">{userData.name}</div>
                <div className="text-gray-500">{userData.organization.name}</div>
              </div>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-gray-600 bg-gray-50 hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
} 