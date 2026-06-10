/**
 * Service-role Supabase client.
 *
 * Bypasses Row Level Security, so it MUST only ever be created and used
 * inside server-side code (Server Components, Route Handlers, Server
 * Actions) — never in a Client Component. It is used by the /admin panel
 * to read every conversation, contractor and payment regardless of RLS,
 * and by the checkout / commitment APIs to record payments.
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase service role environment variables are missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
