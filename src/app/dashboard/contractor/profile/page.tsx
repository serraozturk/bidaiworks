import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProfileEditor from './editor';

export default async function ContractorProfilePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'contractor') {
    redirect('/dashboard');
  }

  let { data: contractor, error: contractorError } = await supabase
    .from('contractor_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (contractorError) {
    console.error('Contractor profile fetch error:', contractorError);
  }

  if (!contractor) {
    const { data: createdContractor, error: createContractorError } =
      await supabase
        .from('contractor_profiles')
        .insert({
          user_id: user.id,
          company_name: 'New Contractor Company',
          license_number: null,
          years_in_business: null,
          bio: null,
          website: null,
        })
        .select('*')
        .single();

    if (createContractorError) {
      console.error('Contractor profile create error:', createContractorError);
    }

    contractor = createdContractor;
  }

  const { data: allCategories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  const { data: contractorCategories } = await supabase
    .from('contractor_categories')
    .select('category_id')
    .eq('contractor_id', user.id);

  const { data: serviceAreas } = await supabase
    .from('contractor_service_areas')
    .select('zip_code')
    .eq('contractor_id', user.id);

  const chosenCategoryIds =
    contractorCategories?.map((item) => item.category_id).filter(Boolean) ?? [];

  const chosenZips =
    serviceAreas?.map((item) => item.zip_code).filter(Boolean) ?? [];

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <Link
            href="/dashboard/contractor"
            className="mb-4 inline-flex items-center gap-1 text-sm font-black text-slate-500 hover:text-[#f45112]"
          >
            ← Back to dashboard
          </Link>

          <p className="text-xs font-black uppercase tracking-wide text-orange-600">
            Contractor settings
          </p>

          <h1 className="mt-1 text-3xl font-black text-slate-950">
            Contractor Profile
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manage your company details, service categories and ZIP codes.
            Homeowners will see this information before accepting your offers.
          </p>
        </div>

        <ProfileEditor
          contractor={contractor}
          allCategories={allCategories ?? []}
          chosenCategoryIds={chosenCategoryIds}
          chosenZips={chosenZips}
        />
      </div>
    </main>
  );
}