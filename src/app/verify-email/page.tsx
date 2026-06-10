import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import VerifyEmailClient from './verify-email-client';

export const dynamic = 'force-dynamic';

/**
 * Holding page for a logged-in user who has not confirmed their email.
 * The middleware routes unverified users here before they can reach the
 * dashboard, onboarding or admin areas.
 */
export default async function VerifyEmailPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (user.email_confirmed_at) redirect('/dashboard');

  return <VerifyEmailClient email={user.email ?? ''} />;
}
