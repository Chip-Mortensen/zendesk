'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';

interface Customer {
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadCustomers() {
      try {
        console.log('=== Starting loadCustomers ===');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Current session user:', session?.user?.id);

        if (!session) {
          console.log('No session found');
          return;
        }

        // Get user's organization
        console.log('Fetching organization for user:', session.user.id);
        const { data, error: orgError } = await supabase
          .from('org_members')
          .select(`
            organization_id,
            role,
            organizations!inner (
              name
            )
          `)
          .eq('user_id', session.user.id)
          .in('role', ['admin', 'employee'])
          .single();

        console.log('Organization query:', {
          data,
          orgError,
          orgId: data?.organization_id,
          userRole: data?.role
        });

        if (data?.organization_id) {
          console.log('=== Fetching customers ===');
          console.log('Organization ID:', data.organization_id);

          // Get only customers for this organization
          const { data: customersData, error: customerError } = await supabase
            .from('org_members')
            .select('*, users!inner(*)')
            .eq('organization_id', data.organization_id)
            .eq('role', 'customer');

          console.log('Customer query:', {
            sql: `SELECT * FROM org_members om INNER JOIN users u ON u.id = om.user_id WHERE om.organization_id = '${data.organization_id}' AND om.role = 'customer'`,
            result: customersData,
            error: customerError
          });

          if (customerError) {
            console.error('Error fetching customers:', customerError);
            return;
          }

          const mappedCustomers = (customersData || []).map(c => ({
            user_id: c.user_id,
            name: c.users?.name || 'Unknown',
            email: c.users?.email || 'Unknown',
            role: c.role,
            created_at: c.created_at
          }));

          console.log('=== Final Results ===');
          console.log('Raw customer data:', customersData);
          console.log('Mapped customers:', mappedCustomers);
          setCustomers(mappedCustomers);
        } else {
          console.error('Access denied: Only admins and employees can view customers');
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error loading customers:', error);
      } finally {
        setLoading(false);
      }
    }

    loadCustomers();
  }, [router]);

  if (loading) {
    return <div className="text-center">Loading customers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
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