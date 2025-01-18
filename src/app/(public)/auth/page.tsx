'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';

type AuthMode = 'signin' | 'signup';
type UserType = 'customer' | 'admin';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface OrgMember {
  organization_id: string;
  role: 'admin' | 'customer';
  organizations: Organization;
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

export default function AuthPage() {
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

  // Set initial state based on URL parameters
  useEffect(() => {
    const urlType = searchParams.get('type');
    if (urlType === 'admin') {
      setUserType('admin');
    } else if (urlType === 'customer') {
      setUserType('customer');
      // Fetch organizations when in customer mode
      fetchOrganizations();
    } else {
      // If no type specified, redirect to home
      router.push('/');
    }
  }, [searchParams, router]);

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
    } catch (error: any) {
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      setErrors(prev => ({
        ...prev,
        general: `Failed to load organizations: ${error.message || 'Unknown error'}`
      }));
    } finally {
      setIsLoadingOrgs(false);
    }
  };

  // Add debugging for organizations state
  useEffect(() => {
    console.log('Current organizations:', organizations);
  }, [organizations]);

  const getPortalTitle = () => {
    const portalType = userType === 'admin' ? 'Admin' : 'Customer';
    return `${portalType} Portal ${mode === 'signin' ? 'Sign In' : 'Sign Up'}`;
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};

    if (mode === 'signup') {
      if (userType === 'admin') {
        if (!formData.name?.trim()) {
          newErrors.name = 'Name is required';
        }
        if (!formData.orgName?.trim()) {
          newErrors.orgName = 'Organization name is required';
        }
      } else {
        if (!formData.name?.trim()) {
          newErrors.name = 'Name is required';
        }
        if (!formData.organizationId) {
          newErrors.organizationId = 'Please select an organization';
        }
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (mode === 'signup' && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

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
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      if (mode === 'signup') {
        console.log('Starting signup process...');
        // First create the user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              user_type: userType
            }
          }
        });

        console.log('Auth signup result:', { authData, authError });
        if (authError) throw authError;

        if (!authData.user?.id) {
          throw new Error('No user ID returned from signup');
        }

        if (userType === 'admin') {
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

          // Only redirect after confirming membership was created
          router.push(`/org/${orgData.slug}`);
        }
      } else {
        // Handle sign in
        const { data: { user }, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        // Get user's organization and role
        const { data: memberData, error: memberError } = await supabase
          .from('org_members')
          .select('organization_id, role, organizations!inner(slug)')
          .eq('user_id', user!.id)
          .single();

        if (memberError) throw memberError;

        if (memberData.role === 'admin') {
          router.push('/dashboard');
        } else {
          // Type assertion since we know the structure
          const orgData = memberData.organizations as { slug: string };
          router.push(`/org/${orgData.slug}`);
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      setErrors({
        general: error.message || 'An error occurred. Please try again.'
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
                  className={`mt-1 block w-full rounded-md shadow-sm ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  } focus:border-blue-500 focus:ring-blue-500 sm:text-sm`}
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

              {mode === 'signup' && userType === 'admin' && (
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

              {mode === 'signup' && userType === 'customer' && (
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