/**
 * Admin access control.
 *
 * Admins can be identified in two ways:
 * 1. ADMIN_EMAILS env allowlist
 * 2. profiles.role = 'admin'
 *
 * This keeps local development easy while still allowing a hard email allowlist.
 */
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

export async function getAdminUser(): Promise<User | null> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  // 1. Env allowlist admin
  if (isAdminEmail(user.email)) {
    return user;
  }

  // 2. Database role admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) return null;

  if (profile.role !== 'admin') return null;

  return user;
}