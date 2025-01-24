import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

interface Organization {
  slug: string;
}

interface MemberData {
  organization_id: string;
  role: string;
  organizations: Organization;
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    const { userType } = await request.json();
    
    const credentials = {
      admin: {
        email: process.env.TEST_ADMIN_EMAIL,
        password: process.env.TEST_ADMIN_PASSWORD
      },
      employee: {
        email: process.env.TEST_EMPLOYEE_EMAIL,
        password: process.env.TEST_EMPLOYEE_PASSWORD
      },
      customer: {
        email: process.env.TEST_CUSTOMER_EMAIL,
        password: process.env.TEST_CUSTOMER_PASSWORD
      }
    }[userType as 'admin' | 'employee' | 'customer'];

    if (!credentials?.email || !credentials?.password) {
      console.error('Missing credentials for user type:', userType);
      return NextResponse.json(
        { error: 'Invalid user type or missing credentials' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password
    });

    if (error) {
      console.error('Auth error:', error);
      throw error;
    }

    if (!data.session) {
      console.error('No session returned');
      throw new Error('No session returned from sign in');
    }

    // Get user's organization and role
    const { data: memberData, error: memberError } = await supabase
      .from('org_members')
      .select(`
        organization_id,
        role,
        organizations!inner (
          slug
        )
      `)
      .eq('user_id', data.user.id)
      .single();

    if (memberError) {
      console.error('Member data error:', memberError);
      throw memberError;
    }

    if (!memberData) {
      console.error('No member data found for user:', data.user.id);
      throw new Error('User organization data not found');
    }

    // Safe type casting through unknown first
    const typedMemberData = memberData as unknown as MemberData;
    // Handle the case where organizations might be null
    const organizationSlug = typedMemberData.organizations?.slug;
    if (typedMemberData.role === 'customer' && !organizationSlug) {
      console.error('No organization slug found for customer:', data.user.id);
      throw new Error('Organization data not found');
    }

    return NextResponse.json({
      success: true,
      role: typedMemberData.role,
      redirect: typedMemberData.role === 'customer' 
        ? `/org/${organizationSlug}`
        : '/dashboard'
    });

  } catch (error) {
    console.error('Test auth error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
} 