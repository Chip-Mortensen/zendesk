import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * This middleware is responsible for:
 * 1. Refreshing the user's session if it's expired
 * 2. Ensuring proper cookie management for Supabase auth
 * 
 * Note: Role-based authorization is handled at the layout level
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Await the session check to ensure proper cookie handling
  const { data: { session } } = await supabase.auth.getSession();
  
  return res;
}

// Only run middleware on authenticated routes
export const config = {
  matcher: ['/dashboard/:path*', '/org/:path*']
} 