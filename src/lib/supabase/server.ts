/**
 * Server-side Supabase client for Server Components, Server Actions, and
 * Route Handlers. Reads the user's session cookie set by the browser.
 *
 * Usage:
 *   const supabase = createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // In Server Components we can't write cookies; the middleware
          // refreshes them for us. Wrapping in try/catch lets this fail
          // silently when called from a Server Component.
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            /* noop */
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            /* noop */
          }
        },
      },
    },
  );
}
