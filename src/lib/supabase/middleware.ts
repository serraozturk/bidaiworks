/**
 * Helper used by src/middleware.ts to refresh the auth cookie on every
 * request. Without this, Server Components sometimes see a stale session.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasSupabaseEnv } from '@/lib/env';

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith('/dashboard') ||
    path.startsWith('/onboarding') ||
    path.startsWith('/admin');

  // Forward the current pathname to server components via REQUEST headers
  // (server components read request headers via next/headers `headers()`).
  // Every NextResponse.next() — including the ones recreated inside the
  // Supabase cookie callbacks below — must reuse these headers, otherwise
  // the value disappears on requests where Supabase refreshes the session
  // cookie, which is what caused NavBar to flicker on /admin pages.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set('x-pathname', path);
  const buildResponse = () =>
    NextResponse.next({ request: { headers: forwardedHeaders } });

  let response = buildResponse();

  if (!hasSupabaseEnv()) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', path + request.nextUrl.search);
      return NextResponse.redirect(url);
    }

    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = buildResponse();
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = buildResponse();
          response.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  // Refresh the session if it's expired. getUser() forces a token refresh.
  const { data: { user } } = await supabase.auth.getUser();

  // Auth gate: anything under /dashboard requires a logged-in user.
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Email verification gate: a logged-in user must confirm their email
  // before they can use the marketplace. Unverified users are routed to
  // /verify-email until they confirm.
  if (isProtected && user && !user.email_confirmed_at) {
    const url = request.nextUrl.clone();
    url.pathname = '/verify-email';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // A verified user landing on /verify-email belongs in their dashboard.
  if (path === '/verify-email' && user?.email_confirmed_at) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // If a logged-in user hits /login or /signup, send them to their dashboard.
  if ((path === '/login' || path === '/signup') && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}
