/**
 * Browser-side Supabase client.
 * Used inside Client Components (`"use client"`).
 * Never expose the service-role key here — only NEXT_PUBLIC_* vars.
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
