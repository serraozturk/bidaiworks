import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * /dashboard entry point.
 *
 * Redirects user to the correct workspace:
 * - admin -> admin panel
 * - contractor -> contractor dashboard or onboarding
 * - homeowner -> homeowner dashboard
 */
export default async function DashboardEntry() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile?.role) {
    redirect('/onboarding/homeowner');
  }

  // Admin kullanıcı direkt admin paneline gitsin
  if (profile.role === 'admin') {
    redirect('/admin');
  }

  // Contractor kullanıcı contractor dashboard'a veya onboarding'e gitsin
  if (profile.role === 'contractor') {
    const { data: contractorProfile } = await supabase
      .from('contractor_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    redirect(
      contractorProfile ? '/dashboard/contractor' : '/onboarding/contractor',
    );
  }

  // Homeowner kullanıcı homeowner dashboard'a gitsin
  if (profile.role === 'homeowner') {
    redirect('/dashboard/homeowner');
  }

  // Bilinmeyen rol varsa güvenli fallback
  redirect('/login');
}