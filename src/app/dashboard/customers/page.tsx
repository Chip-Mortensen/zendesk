'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';
import SortableHeader from '@/components/table/SortableHeader';

interface Customer {
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  ticket_count: number;
}

type SortDirection = 'asc' | 'desc';

function sortCustomers(
  customers: Customer[],
  field: string,
  direction: SortDirection
): Customer[] {
  return [...customers].sort((a, b) => {
    switch (field) {
      case 'name':
        return direction === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      case 'email':
        return direction === 'asc'
          ? a.email.localeCompare(b.email)
          : b.email.localeCompare(a.email);
      case 'created_at':
        return direction === 'asc'
          ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'ticket_count':
        return direction === 'asc'
          ? a.ticket_count - b.ticket_count
          : b.ticket_count - a.ticket_count;
      default:
        return 0;
    }
  });
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: SortDirection }>({
    field: 'created_at',
    direction: 'desc'
  });
  const router = useRouter();

  useEffect(() => {
    async function loadCustomers() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error('No session found');
          router.push('/auth?type=admin');
          return;
        }

        // Get user's organization
        const { data } = await supabase
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

        if (!data) {
          console.error('No organization found for user');
          router.push('/auth?type=admin');
          return;
        }

        if (data?.organization_id) {
          // First get customers
          const { data: customersData, error: customerError } = await supabase
            .from('org_members')
            .select(`
              *,
              users!inner (
                id,
                name,
                email
              )
            `)
            .eq('organization_id', data.organization_id)
            .eq('role', 'customer');

          if (customerError) {
            console.error('Error fetching customers:', customerError);
            return;
          }

          // Then get ticket counts for each customer
          const { data: ticketCounts, error: ticketError } = await supabase
            .rpc('get_customer_ticket_counts', {
              org_id: data.organization_id
            });

          if (ticketError) {
            console.error('Error fetching ticket counts:', ticketError);
            return;
          }

          // Create a map of user_id to ticket count
          const ticketCountMap = new Map(
            (ticketCounts as Array<{ user_id: string; count: number }> || [])
              .map(t => [t.user_id, t.count])
          );

          const mappedCustomers = (customersData || []).map(c => ({
            user_id: c.user_id,
            name: c.users?.name || 'Unknown',
            email: c.users?.email || 'Unknown',
            role: c.role,
            created_at: c.created_at,
            ticket_count: ticketCountMap.get(c.user_id) || 0
          }));

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

  const handleSort = (field: string) => {
    setSortConfig(current => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedCustomers = useMemo(() => {
    return sortCustomers(customers, sortConfig.field, sortConfig.direction);
  }, [customers, sortConfig]);

  if (loading) {
    return <div className="text-center py-12">Loading customers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage all customers in your organization.
          </p>
        </div>

        {customers.length === 0 ? (
          <div className="p-6 text-gray-500">No customers found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader
                  label="Name"
                  field="name"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Email"
                  field="email"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Tickets"
                  field="ticket_count"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Joined"
                  field="created_at"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedCustomers.map((customer) => (
                <tr 
                  key={customer.user_id}
                  className="transition-colors duration-150 hover:bg-gray-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {customer.ticket_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(customer.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
} 