import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import VerificationGate from './VerificationGate';

/**
 * Contractor layout — verification gate for ALL /dashboard/contractor/* routes.
 *
 * Verified contractors: full access.
 * Pending / rejected / suspended: blocked, BUT /dashboard/contractor/profile
 * is always accessible so they can fix their details and resubmit.
 * The path check is done client-side in VerificationGate via usePathname().
 */
export default async function ContractorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: profile }, { data: contractorProfile }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('contractor_profiles')
      .select('company_name, verification_status, rejection_reason')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (profile?.role !== 'contractor') redirect('/dashboard');
  if (!contractorProfile) redirect('/onboarding/contractor');

  const verificationStatus =
    (contractorProfile as any).verification_status ?? 'pending_verification';

  const rejectionReason = (contractorProfile as any).rejection_reason as
    | string
    | null;

  return (
    <VerificationGate
      verificationStatus={verificationStatus}
      rejectionReason={rejectionReason}
    >
      {children}
    </VerificationGate>
  );
}
