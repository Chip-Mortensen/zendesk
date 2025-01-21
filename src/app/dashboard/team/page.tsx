'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

interface TeamMember {
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

export default function TeamPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    async function loadTeamMembers() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Get user's organization and role
        const { data: memberData } = await supabase
          .from('org_members')
          .select(`
            organization_id,
            role,
            organizations!inner (
              name
            )
          `)
          .eq('user_id', session.user.id)
          .single();

        if (memberData?.organization_id) {
          setOrganizationId(memberData.organization_id);
          setUserRole(memberData.role);

          // Get all team members for this organization
          const { data: members } = await supabase
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
            .eq('organization_id', memberData.organization_id)
            .in('role', ['admin', 'employee'])
            .order('created_at', { ascending: false });

          setTeamMembers(
            ((members as unknown) as OrgMemberWithUser[])?.map(m => ({
              user_id: m.user_id,
              name: m.users.name,
              email: m.users.email,
              role: m.role,
              created_at: m.created_at
            })) || []
          );
        }
      } catch (error) {
        console.error('Error loading team members:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTeamMembers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    setError('');
    setSuccess('');

    try {
      // Create invite link
      const { data: invite, error: inviteError } = await supabase.rpc(
        'create_employee_invite',
        {
          p_organization_id: organizationId,
          p_email: inviteEmail.trim(),
          p_created_by: (await supabase.auth.getSession()).data.session?.user.id,
          p_expires_in_hours: 48
        }
      );

      if (inviteError) throw inviteError;

      // Generate the invite URL
      const inviteUrl = `${window.location.origin}/auth?type=admin&invite=${invite.token}`;

      setSuccess('Invite link created successfully! Share this link with the employee: ' + inviteUrl);
      setInviteEmail('');

    } catch (error) {
      console.error('Error creating invite:', error);
      setError('Failed to create invite. Please try again.');
    }
  };

  if (loading) {
    return <div className="text-center">Loading team members...</div>;
  }

  // Only admins can see this page
  if (userRole !== 'admin') {
    return <div className="text-center text-red-600">Access denied. Only administrators can view this page.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Team Members</h1>
      </div>

      {/* Invite form */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Invite Team Member</h2>
        <form onSubmit={handleInvite} className="space-y-4">
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
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          {success && (
            <div className="text-green-500 text-sm break-all">{success}</div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Send Invite
            </button>
          </div>
        </form>
      </div>

      {/* Team member list */}
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
            {teamMembers.map((member) => (
              <tr key={member.user_id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {member.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {member.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {member.role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(member.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 