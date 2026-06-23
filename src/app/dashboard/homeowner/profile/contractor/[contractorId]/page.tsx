import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface Params {
  params: { contractorId: string };
  searchParams: { from?: string };
}

export default async function ContractorProfileForHomeownerPage({ params, searchParams }: Params) {
  const supabase = createClient();
  const db = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Find any conversation between this homeowner and the contractor
  const { data: conversation } = await supabase
    .from('conversations')
    .select('project_id, projects(status)')
    .eq('homeowner_id', user.id)
    .eq('contractor_id', params.contractorId)
    .maybeSingle();

  // Must have at least one conversation to see the profile at all
  if (!conversation) redirect('/dashboard/homeowner');

  const projectStatus = (conversation as any)?.projects?.status ?? null;

  // Contact details only unlock once the contractor has committed (job is in_progress)
  const contactUnlocked = ['in_progress', 'completed'].includes(projectStatus ?? '');

  const [
    { data: company },
    { data: categories },
    { data: areas },
    { data: reviews },
    { data: completedProjects },
  ] = await Promise.all([
    db
      .from('contractor_profiles')
      .select(
        'company_name, bio, years_in_business, website, logo_url, rating_avg, rating_count, response_time_hours, verification_status, phone, address_line, city, state, zip_code, insurance_status, license_state, created_at',
      )
      .eq('user_id', params.contractorId)
      .maybeSingle(),
    db
      .from('contractor_categories')
      .select('categories(name)')
      .eq('contractor_id', params.contractorId),
    db
      .from('contractor_service_areas')
      .select('city, state')
      .eq('contractor_id', params.contractorId)
      .limit(12),
    db
      .from('reviews')
      .select('id, rating, comment, created_at, reviewer_id, profiles(full_name)')
      .eq('contractor_id', params.contractorId)
      .order('created_at', { ascending: false })
      .limit(10),
    // Real completed jobs: projects where this contractor was awarded AND completed
    db
      .from('projects')
      .select('id, awarded_offer_id, offers!inner(sender_id)')
      .eq('status', 'completed')
      .eq('offers.sender_id', params.contractorId),
  ]);

  if (!company) notFound();

  const backHref = searchParams.from ?? '/dashboard/homeowner';
  const isVerified = company.verification_status === 'verified';
  const categoryNames = (categories ?? [])
    .map((c: any) => c.categories?.name)
    .filter(Boolean) as string[];
  const serviceAreas = areas ?? [];
  const reviewRows = reviews ?? [];
  const realCompletedCount = (completedProjects ?? []).length;
  const avgRating = Number(company.rating_avg ?? 0);
  const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <Link href={backHref} className="text-xs font-bold text-slate-500 hover:text-orange-600">
            ← Back
          </Link>
          <span className="text-xs font-semibold text-slate-400">Contractor profile</span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">

        {/* Hero card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-orange-50 to-orange-100" />
          <div className="px-6 pb-6">
            <div className="-mt-10 mb-4 flex items-end gap-4">
              <div className="h-20 w-20 rounded-2xl border-4 border-white bg-gradient-to-br from-orange-400 to-orange-600 shadow-md flex items-center justify-center text-3xl font-black text-white">
                {company.company_name?.charAt(0)?.toUpperCase() ?? 'C'}
              </div>
              <div className="pb-1">
                {isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-700">
                    ✓ Verified
                  </span>
                )}
              </div>
            </div>

            <h1 className="text-2xl font-black text-slate-900">{company.company_name}</h1>
            {company.city && (
              <p className="mt-1 text-sm text-slate-500">
                📍 {company.city}{company.state ? `, ${company.state}` : ''}
              </p>
            )}

            {company.bio && (
              <p className="mt-3 text-sm leading-6 text-slate-600">{company.bio}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Rating"
            value={avgRating > 0 ? `${avgRating.toFixed(1)} / 5` : '—'}
            sub={avgRating > 0 ? stars(avgRating) : ''}
          />
          <StatCard label="Reviews" value={String(company.rating_count ?? 0)} />
          <StatCard label="Jobs completed" value={String(realCompletedCount)} />
          <StatCard
            label="Years active"
            value={company.years_in_business ? `${company.years_in_business} yr` : '—'}
          />
        </div>

        {/* Services — always visible */}
        {categoryNames.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Services</h2>
            <div className="flex flex-wrap gap-2">
              {categoryNames.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700 border border-orange-100"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contact & credentials — only after job confirmed (in_progress) */}
        {contactUnlocked ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-emerald-700">
              Contact & credentials
            </h2>
            <ul className="space-y-2 text-sm">
              {company.phone && (
                <li>
                  <a href={`tel:${company.phone}`} className="flex items-center gap-2 font-semibold text-slate-700 hover:text-orange-600">
                    📞 {company.phone}
                  </a>
                </li>
              )}
              {company.website && (
                <li>
                  <a href={company.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-semibold text-orange-600 hover:underline">
                    🌐 {company.website.replace(/^https?:\/\//, '')}
                  </a>
                </li>
              )}
              {company.address_line && (
                <li className="flex items-start gap-2 text-slate-600">
                  📍 {company.address_line}{company.city ? `, ${company.city}` : ''}{company.state ? `, ${company.state}` : ''}
                </li>
              )}
              {company.license_state && (
                <li className="text-slate-500">🪪 Licensed in {company.license_state}</li>
              )}
              {company.insurance_status === 'verified' && (
                <li className="text-emerald-700">🛡️ Insurance verified</li>
              )}
              {company.response_time_hours && (
                <li className="text-slate-500">⚡ Avg. response {company.response_time_hours}h</li>
              )}
            </ul>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 shadow-sm text-center">
            <p className="text-sm font-semibold text-slate-400">
              🔒 Phone, website and address unlock once the contractor confirms the job.
            </p>
          </div>
        )}

        {/* Service areas — always visible */}
        {serviceAreas.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Service areas</h2>
            <div className="flex flex-wrap gap-2">
              {serviceAreas.map((a: any, i) => (
                <span key={i} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {a.city}{a.state ? `, ${a.state}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reviews — always visible */}
        {reviewRows.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-black text-slate-900">
                Reviews
                <span className="ml-2 text-[11px] font-bold text-slate-400">({reviewRows.length})</span>
              </h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {reviewRows.map((r: any) => (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-amber-400">{stars(r.rating)}</span>
                    <span className="text-xs font-bold text-slate-500">
                      {r.profiles?.full_name ?? 'Homeowner'} ·{' '}
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="mt-1 text-sm text-slate-600">{r.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
      <div className="text-xl font-black text-slate-900">{value}</div>
      {sub && <div className="text-sm text-amber-400">{sub}</div>}
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
