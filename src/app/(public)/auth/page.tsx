'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';

type AuthMode = 'signin' | 'signup';
type UserType = 'customer' | 'admin';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface FormData {
  name?: string;
  email: string;
  password: string;
  organizationId?: string;
  orgName?: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  organizationId?: string;
  orgName?: string;
  general?: string;
}

interface InviteData {
  email: string;
  organization_id: string;
  organization_name: string;
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [userType, setUserType] = useState<UserType>('customer');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);

  // Set initial state based on URL parameters
  useEffect(() => {
    const urlType = searchParams.get('type');
    if (urlType === 'admin') {
      setUserType('admin');
    } else if (urlType === 'customer') {
      setUserType('customer');
      // Fetch organizations when in customer mode
      fetchOrganizations();
    }
  }, [searchParams, router]);

  // Check for invite token
  useEffect(() => {
    const inviteToken = searchParams.get('invite');
    if (inviteToken) {
      console.log('Found invite token:', inviteToken);
      verifyInvite(inviteToken);
    }
  }, [searchParams]);

  const fetchOrganizations = async () => {
    setIsLoadingOrgs(true);
    try {
      console.log('Fetching organizations...');
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug');
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('No organizations found');
      } else {
        console.log('Found organizations:', data);
      }
      
      setOrganizations(data || []);
    } catch (error: unknown) {
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      setErrors(prev => ({
        ...prev,
        general: `Failed to load organizations: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    } finally {
      setIsLoadingOrgs(false);
    }
  };

  const verifyInvite = async (token: string) => {
    try {
      console.log('Starting invite verification for token:', token);
      
      // Set the invite token for RLS policy
      const { error: setTokenError } = await supabase.rpc('set_invite_token', { token });
      console.log('Set invite token result:', { setTokenError });
      if (setTokenError) {
        console.error('Error setting invite token:', setTokenError);
      }

      // Verify the invite
      console.log('Calling verify_invite with token:', token);
      const { data: verifyData, error: verifyError } = await supabase.rpc('verify_invite', {
        p_token: token
      });
      console.log('Verify invite result:', { verifyData, verifyError });

      if (verifyError) {
        console.error('Verification error:', verifyError);
        setErrors({ general: verifyError.message });
        return;
      }

      // verifyData comes back as an array with one row
      const verifyResult = verifyData?.[0];
      console.log('Verify result row:', verifyResult);

      if (!verifyResult?.is_valid) {
        console.log('Invalid invite data:', verifyResult);
        setErrors({ general: 'Invalid or expired invite link' });
        return;
      }

      // Get organization name
      console.log('Getting organization details for:', verifyResult.organization_id);
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', verifyResult.organization_id)
        .single();
      console.log('Organization lookup result:', { orgData, orgError });

      if (orgError) {
        console.error('Error fetching organization:', orgError);
      }

      const inviteInfo = {
        email: verifyResult.email,
        organization_id: verifyResult.organization_id,
        organization_name: orgData?.name || 'Unknown Organization'
      };
      console.log('Setting invite data:', inviteInfo);
      setInviteData(inviteInfo);

      // Pre-fill and lock the email
      console.log('Pre-filling email:', verifyResult.email);
      setFormData(prev => ({
        ...prev,
        email: verifyResult.email
      }));

      // Force signup mode
      setMode('signup');
    } catch (error) {
      console.error('Error in verifyInvite:', error);
      setErrors({ general: 'Failed to verify invite link' });
    }
  };

  // Add debugging for organizations state
  useEffect(() => {
    console.log('Current organizations:', organizations);
  }, [organizations]);

  const getPortalTitle = () => {
    if (inviteData) {
      return `Join ${inviteData.organization_name}`;
    }
    const portalType = userType === 'admin' ? 'Admin' : 'Customer';
    return `${portalType} Portal ${mode === 'signin' ? 'Sign In' : 'Sign Up'}`;
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
    console.log('Validating form with mode:', mode, 'userType:', userType, 'inviteData:', inviteData);

    if (mode === 'signup') {
      if (!inviteData) {  // Only check these for non-invite signups
        if (userType === 'admin') {
          if (!formData.name?.trim()) {
            console.log('Validation failed: admin name required');
            newErrors.name = 'Name is required';
          }
          if (!formData.orgName?.trim()) {
            console.log('Validation failed: admin org name required');
            newErrors.orgName = 'Organization name is required';
          }
        } else {
          if (!formData.name?.trim()) {
            console.log('Validation failed: customer name required');
            newErrors.name = 'Name is required';
          }
          if (!formData.organizationId) {
            console.log('Validation failed: customer org selection required');
            newErrors.organizationId = 'Please select an organization';
          }
        }
      } else {
        // For invite signups, only validate name
        if (!formData.name?.trim()) {
          console.log('Validation failed: invite name required');
          newErrors.name = 'Name is required';
        }
      }
    }

    if (!formData.email.trim()) {
      console.log('Validation failed: email required');
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      console.log('Validation failed: invalid email format');
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      console.log('Validation failed: password required');
      newErrors.password = 'Password is required';
    } else if (mode === 'signup' && formData.password.length < 6) {
      console.log('Validation failed: password too short');
      newErrors.password = 'Password must be at least 6 characters';
    }

    console.log('Validation errors:', newErrors);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with data:', formData);
    console.log('Current invite data:', inviteData);
    console.log('Current mode:', mode);
    
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'signup') {
        console.log('Starting signup process...');
        // First create the user
        const signupData = {
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              user_type: inviteData ? 'employee' : userType
            }
          }
        };
        console.log('Sending signup request with:', signupData);
        
        const { data: authData, error: authError } = await supabase.auth.signUp(signupData);

        console.log('Auth signup result:', { authData, authError });
        if (authError) throw authError;

        if (!authData.user?.id) {
          throw new Error('No user ID returned from signup');
        }

        if (inviteData) {
          // Create employee membership
          console.log('Creating employee membership:', {
            user_id: authData.user.id,
            organization_id: inviteData.organization_id,
            role: 'employee'
          });

          const { data: memberData, error: memberError } = await supabase
            .from('org_members')
            .insert([
              {
                user_id: authData.user.id,
                organization_id: inviteData.organization_id,
                role: 'employee'
              }
            ])
            .select();

          console.log('Employee membership result:', { memberData, memberError });
          
          if (memberError) {
            console.error('Detailed membership error:', {
              code: memberError.code,
              message: memberError.message,
              details: memberError.details,
              hint: memberError.hint
            });
            throw memberError;
          }

          // Mark invite as used
          if (inviteData) {
            const { email, organization_id } = inviteData;
            console.log('Attempting to mark invite as used:', { email, organization_id });
            const { data: updateData, error: updateError } = await supabase
              .from('invite_links')
              .update({ used_at: new Date().toISOString() })
              .eq('email', email)
              .eq('organization_id', organization_id);

            console.log('Update invite result:', { updateData, updateError });
            if (updateError) {
              console.error('Failed to mark invite as used:', updateError);
            }
          }

          // Add delay before redirect
          await new Promise(resolve => setTimeout(resolve, 500));
          router.push('/dashboard');
        } else if (userType === 'admin') {
          console.log('Creating organization for admin...');
          // Create organization for admin
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .insert([
              { 
                name: formData.orgName || '',
                slug: (formData.orgName || '').toLowerCase().replace(/\s+/g, '-')
              }
            ])
            .select()
            .single();

          console.log('Org creation result:', { orgData, orgError });
          if (orgError) throw orgError;

          console.log('Creating admin membership...');
          // Create admin membership
          const { data: memberData, error: memberError } = await supabase
            .from('org_members')
            .insert([
              {
                user_id: authData.user.id,
                organization_id: orgData.id,
                role: 'admin'
              }
            ])
            .select();

          console.log('Admin membership result:', { memberData, memberError });
          if (memberError) throw memberError;
          
          // Add delay before redirect
          await new Promise(resolve => setTimeout(resolve, 500));
          router.push('/dashboard');
        } else {
          console.log('Creating customer membership...', {
            userId: authData.user.id,
            organizationId: formData.organizationId,
            role: 'customer'
          });

          // Get organization details first
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('id, slug')
            .eq('id', formData.organizationId)
            .single();

          console.log('Organization lookup result:', { orgData, orgError });
          if (orgError) throw orgError;
          if (!orgData) throw new Error('Organization not found');

          // Create membership
          const { data: memberData, error: memberError } = await supabase
            .from('org_members')
            .insert([
              {
                user_id: authData.user.id,
                organization_id: formData.organizationId,
                role: 'customer'
              }
            ])
            .select()
            .single();

          console.log('Customer membership result:', { memberData, memberError });
          
          if (memberError) {
            console.error('Detailed membership error:', {
              code: memberError.code,
              message: memberError.message,
              details: memberError.details,
              hint: memberError.hint
            });
            throw memberError;
          }

          if (!memberData) {
            throw new Error('Failed to create organization membership - no data returned');
          }

          // Add delay before redirect
          await new Promise(resolve => setTimeout(resolve, 500));
          router.push(`/org/${orgData.slug}`);
        }
      } else {
        // Handle sign in
        console.log('Starting sign in...');
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        console.log('Sign in result:', { data, error });
        if (error) throw error;

        if (!data.session) {
          throw new Error('No session returned from sign in');
        }

        // Explicitly set the session
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        if (sessionError) {
          console.error('Error setting session:', sessionError);
          throw sessionError;
        }

        console.log('Session set successfully');

        // Get user's organization and role
        console.log('Fetching user organization and role...');
        const { data: memberData, error: memberError } = await supabase
          .from('org_members')
          .select('organization_id, role, organizations!inner(slug)')
          .eq('user_id', data.user!.id)
          .single();

        console.log('Member data result:', { memberData, memberError });
        if (memberError) throw memberError;

        // Redirect based on role and requested access type
        if (userType === 'admin') {
          // Only admins and employees can access the dashboard
          if (memberData.role === 'admin' || memberData.role === 'employee') {
            router.push('/dashboard');
          } else {
            setErrors({ general: 'Access denied: You do not have admin/employee access' });
            await supabase.auth.signOut();
          }
        } else {
          // Only customers can access the customer portal
          if (memberData.role === 'customer') {
            // Get org slug for redirect
            const { data: orgData } = await supabase
              .from('organizations')
              .select('slug')
              .eq('id', memberData.organization_id)
              .single();
            
            if (orgData?.slug) {
              router.push(`/org/${orgData.slug}`);
            } else {
              throw new Error('Organization not found');
            }
          } else {
            setErrors({ general: 'Access denied: You do not have customer access' });
            await supabase.auth.signOut();
          }
        }
      }
    } catch (error: unknown) {
      console.error('Auth error:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'An error occurred. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-md">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
              {getPortalTitle()}
            </h2>

            {!inviteData && (
              <div className="mb-6">
                <nav className="-mb-px flex" aria-label="Tabs">
                  <button
                    onClick={() => setMode('signin')}
                    className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                      mode === 'signin'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setMode('signup')}
                    className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                      mode === 'signup'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Sign Up
                  </button>
                </nav>
              </div>
            )}

            {errors.general && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">
                {errors.general}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name || ''}
                    onChange={handleChange}
                    className={`mt-1 block w-full rounded-md shadow-sm ${
                      errors.name ? 'border-red-300' : 'border-gray-300'
                    } focus:border-blue-500 focus:ring-blue-500 sm:text-sm`}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!!inviteData}
                  className={`mt-1 block w-full rounded-md shadow-sm ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  } focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                    inviteData ? 'bg-gray-100' : ''
                  }`}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`mt-1 block w-full rounded-md shadow-sm ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  } focus:border-blue-500 focus:ring-blue-500 sm:text-sm`}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              {mode === 'signup' && !inviteData && userType === 'admin' && (
                <div>
                  <label htmlFor="orgName" className="block text-sm font-medium text-gray-700">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    id="orgName"
                    name="orgName"
                    value={formData.orgName || ''}
                    onChange={handleChange}
                    className={`mt-1 block w-full rounded-md shadow-sm ${
                      errors.orgName ? 'border-red-300' : 'border-gray-300'
                    } focus:border-blue-500 focus:ring-blue-500 sm:text-sm`}
                  />
                  {errors.orgName && (
                    <p className="mt-1 text-sm text-red-600">{errors.orgName}</p>
                  )}
                </div>
              )}

              {mode === 'signup' && !inviteData && userType === 'customer' && (
                <div>
                  <label htmlFor="organizationId" className="block text-sm font-medium text-gray-700">
                    Organization
                  </label>
                  <select
                    id="organizationId"
                    name="organizationId"
                    value={formData.organizationId || ''}
                    onChange={handleChange}
                    className={`mt-1 block w-full rounded-md shadow-sm ${
                      errors.organizationId ? 'border-red-300' : 'border-gray-300'
                    } focus:border-blue-500 focus:ring-blue-500 sm:text-sm`}
                    disabled={isLoadingOrgs}
                  >
                    <option value="">Select an organization</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                  {isLoadingOrgs && (
                    <p className="mt-1 text-sm text-gray-500">Loading organizations...</p>
                  )}
                  {errors.organizationId && (
                    <p className="mt-1 text-sm text-red-600">{errors.organizationId}</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading 
                  ? (mode === 'signin' ? 'Signing in...' : 'Signing up...') 
                  : (mode === 'signin' ? 'Sign In' : 'Sign Up')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthContent />
    </Suspense>
  );
} 