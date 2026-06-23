import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ContractorOnboardingForm from './form';
import type { Category } from '@/lib/types';

export default async function ContractorOnboarding() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  await supabase
    .from('profiles')
    .update({ role: 'contractor' })
    .eq('id', user.id);

  const { data: existing } = await supabase
    .from('contractor_profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) redirect('/dashboard/contractor');

  // Note: categories has no `active` column - selecting it caused this
  // query to error out and silently return zero categories, leaving the
  // service-category picker empty for every new contractor signup.
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (categoriesError) {
    console.error('Onboarding categories query error:', categoriesError);
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="text-sm font-black uppercase tracking-wide text-[#f45112]">
            Contractor onboarding
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Set up your contractor profile
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Homeowners will review your profile when comparing offers. Add your
            company details, service categories, and coverage ZIPs.
          </p>
        </div>

        <ContractorOnboardingForm categories={(categories ?? []) as Category[]} />
      </div>
    </main>
  );
}
