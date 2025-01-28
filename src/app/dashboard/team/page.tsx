'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import SortableHeader from '@/components/table/SortableHeader';
import { sendTeamInviteEmail } from '@/utils/email';
import MemberTagSpecialization from '@/components/team/MemberTagSpecialization';

interface TeamMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  tag_id: string | null;
}

interface OrgMemberWithUser {
  user_id: string;
  role: string;
  created_at: string;
  tag_id: string | null;
  users: {
    name: string;
    email: string;
  }
}

type SortDirection = 'asc' | 'desc';

function sortTeamMembers(
  members: TeamMember[],
  field: string,
  direction: SortDirection
): TeamMember[] {
  return [...members].sort((a, b) => {
    switch (field) {
      case 'name':
        return direction === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      case 'email':
        return direction === 'asc'
          ? a.email.localeCompare(b.email)
          : b.email.localeCompare(a.email);
      case 'role':
        return direction === 'asc'
          ? a.role.localeCompare(b.role)
          : b.role.localeCompare(a.role);
      case 'created_at':
        return direction === 'asc'
          ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      default:
        return 0;
    }
  });
}

export default function TeamPage() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: SortDirection }>({
    field: 'created_at',
    direction: 'desc'
  });
  const [isLoading, setIsLoading] = useState(false);

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
              tag_id,
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
              created_at: m.created_at,
              tag_id: m.tag_id
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

  const handleSort = (field: string) => {
    setSortConfig(current => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedTeamMembers = useMemo(() => {
    return sortTeamMembers(teamMembers, sortConfig.field, sortConfig.direction);
  }, [teamMembers, sortConfig]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    setError('');
    setSuccess('');
    setIsLoading(true);

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
      const inviteUrl = `${process.env.DEPLOYED_URL}/auth?type=admin&invite=${invite.token}`;

      // Get organization name
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();

      if (orgError) throw orgError;

      // Send invite email
      const { success: emailSuccess, error: emailError } = await sendTeamInviteEmail({
        to: inviteEmail.trim(),
        organizationName: orgData.name,
        inviteUrl
      });

      if (!emailSuccess) {
        throw new Error(emailError || 'Failed to send invite email');
      }

      setSuccess('Team invitation sent successfully to ' + inviteEmail);
      setInviteEmail('');

    } catch (error) {
      console.error('Error creating invite:', error);
      setError(error instanceof Error ? error.message : 'Failed to create invite. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagUpdate = async (memberId: string, newTagId: string | null) => {
    try {
      const { error } = await supabase
        .from('org_members')
        .update({ tag_id: newTagId })
        .eq('user_id', memberId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      // Update local state
      setTeamMembers(current =>
        current.map(member =>
          member.user_id === memberId
            ? { ...member, tag_id: newTagId }
            : member
        )
      );
    } catch (error) {
      console.error('Error updating tag:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading team members...</div>;
  }

  // Only admins can see this page
  if (userRole !== 'admin') {
    return <div className="text-center text-red-600 py-12">Access denied. Only administrators can view this page.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage your organization&apos;s team members.
          </p>
        </div>

        {/* Invite form */}
        <div className="p-6 border-b border-gray-200">
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
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>

        {/* Team member list */}
        {teamMembers.length === 0 ? (
          <div className="p-6 text-gray-500">No team members found</div>
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
                  label="Role"
                  field="role"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tag Specialization
                </th>
                <SortableHeader
                  label="Joined"
                  field="created_at"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedTeamMembers.map((member) => (
                <tr key={member.user_id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {member.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {member.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {member.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {organizationId && (
                      <MemberTagSpecialization
                        memberId={member.user_id}
                        organizationId={organizationId}
                        currentTag={member.tag_id}
                        onTagUpdate={handleTagUpdate}
                      />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(member.created_at).toLocaleDateString()}
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