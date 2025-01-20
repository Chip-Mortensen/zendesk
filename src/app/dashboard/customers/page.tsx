'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

interface Customer {
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface OrgMemberWithUser {
  user_id: string;
  role: string;
  created_at: string;
  users: {
    name: string;
    email: string;
  }
}

export default function CustomersPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function loadCustomers() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Get user's organization
        const { data } = await supabase
          .from('org_members')
          .select(`
            organization_id,
            organizations!inner (
              name
            )
          `)
          .eq('user_id', session.user.id)
          .single();

        if (data?.organization_id) {
          setOrganizationId(data.organization_id);

          // Get all customers for this organization
          const { data: customers } = await supabase
            .from('org_members')
            .select(`
              user_id,
              role,
              created_at,
              users!inner (
                name,
                email
              )
            `)
            .eq('organization_id', data.organization_id)
            .order('created_at', { ascending: false });

          setCustomers(
            ((customers as unknown) as OrgMemberWithUser[])?.map(c => ({
              user_id: c.user_id,
              name: c.users.name,
              email: c.users.email,
              role: c.role,
              created_at: c.created_at
            })) || []
          );
        }
      } catch (error) {
        console.error('Error loading customers:', error);
      } finally {
        setLoading(false);
      }
    }

    loadCustomers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    setError('');
    setSuccess('');

    try {
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteEmail.trim(),
        password: Math.random().toString(36).slice(-8),
        options: {
          data: {
            name: inviteName.trim(),
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No user data returned');

      // Create organization membership
      const { error: memberError } = await supabase
        .from('org_members')
        .insert([
          {
            organization_id: organizationId,
            user_id: authData.user.id,
            role: 'customer',
          },
        ]);

      if (memberError) throw memberError;

      setSuccess('Customer invited successfully! They will receive an email to set their password.');
      setInviteEmail('');
      setInviteName('');

      // Refresh customer list with direct join
      const { data: customers } = await supabase
        .from('org_members')
        .select(`
          user_id,
          role,
          created_at,
          users!inner (
            name,
            email
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      setCustomers(
        ((customers as unknown) as OrgMemberWithUser[])?.map(c => ({
          user_id: c.user_id,
          name: c.users.name,
          email: c.users.email,
          role: c.role,
          created_at: c.created_at
        })) || []
      );
    } catch (error) {
      console.error('Error inviting customer:', error);
      setError('Failed to invite customer. Please try again.');
    }
  };

  if (loading) {
    return <div className="text-center">Loading customers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
      </div>

      {/* Invite form */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Invite Customer</h2>
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          {success && (
            <div className="text-green-500 text-sm">{success}</div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Invite Customer
            </button>
          </div>
        </form>
      </div>

      {/* Customer list */}
      <div className="bg-white shadow rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customers.map((customer) => (
              <tr key={customer.user_id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {customer.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {customer.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {customer.role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(customer.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 