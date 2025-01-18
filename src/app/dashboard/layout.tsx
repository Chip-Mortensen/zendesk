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
  organization: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    async function loadUserData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth?type=admin');
          return;
        }

        // Get user's organization membership
        const { data: memberData, error: memberError } = await supabase
          .from('org_members')
          .select(`
            role,
            organizations (
              name
            )
          `)
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .single();

        if (memberError || !memberData) {
          console.error('Error fetching admin data:', memberError);
          router.push('/auth?type=admin');
          return;
        }

        const typedMemberData = memberData as MemberData;

        setUserData({
          name: session.user.user_metadata.name || 'Admin User',
          email: session.user.email || '',
          role: typedMemberData.role,
          organization: typedMemberData.organizations[0]?.name || '',
        });
      } catch (error) {
        console.error('Error in loadUserData:', error);
        router.push('/auth?type=admin');
      }
    }

    loadUserData();
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

  if (!userData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                  Support System
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
                <div className="text-gray-500">{userData.organization}</div>
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