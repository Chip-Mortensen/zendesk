import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  try {
    // Create authenticated Supabase Client
    const supabase = createMiddlewareClient({ req, res: NextResponse.next() });

    // Refresh session if expired - required for Server Components
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Check if accessing protected routes
    const isAccessingDashboard = req.nextUrl.pathname.startsWith('/dashboard');
    const isAccessingOrg = req.nextUrl.pathname.startsWith('/org/');

    if (isAccessingDashboard || isAccessingOrg) {
      if (!session) {
        // Redirect to auth page with appropriate type
        const redirectTo = isAccessingDashboard ? 'admin' : 'customer';
        return NextResponse.redirect(new URL(`/auth?type=${redirectTo}`, req.url));
      }

      // For dashboard routes, verify admin role
      if (isAccessingDashboard) {
        const { data: memberData } = await supabase
          .from('org_members')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .single();

        if (!memberData) {
          return NextResponse.redirect(new URL('/auth?type=admin', req.url));
        }
      }
    }

    return NextResponse.next();
  } catch (e) {
    console.error('Middleware error:', e);
    return NextResponse.redirect(new URL('/auth?type=customer', req.url));
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
} 