import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Badge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';
import { countUnreadConversations } from '@/lib/unread';

export default async function ContractorsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role =
    (profile?.role as 'homeowner' | 'contractor' | undefined) ?? 'homeowner';

  if (role !== 'homeowner') {
    redirect('/dashboard/contractor');
  }

  const [contractorsResult, unreadMessages] = await Promise.all([
    supabase
      .from('contractor_profiles')
      .select(`
        user_id,
        company_name,
        bio,
        years_in_business,
        verified,
        rating_avg,
        rating_count,
        completed_jobs_count,
        response_time_hours,
        logo_url,
        contractor_categories(
          category_id,
          categories(name, slug)
        ),
        contractor_service_areas(
          zip_code,
          city,
          state
        )
      `)
      .eq('verified', true)
      .order('rating_avg', { ascending: false, nullsFirst: false })
      .limit(48),

    countUnreadConversations(supabase, user.id, 'homeowner'),
  ]);

  const contractors = (contractorsResult.data ?? []) as any[];

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role="homeowner"
          active="contractors"
          messageCount={unreadMessages ?? 0}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1180px] px-5 py-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#f45112]">
                  Contractor directory
                </p>

                <h1 className="mt-1 text-3xl font-black tracking-tight">
                  Contractors near you
                </h1>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Browse contractor profiles, review services and start a
                  structured budget offer from your active project.
                </p>
              </div>

              <Link
                href="/dashboard/homeowner/new"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#f45112] px-4 text-sm font-black text-white hover:bg-[#d94406]"
              >
                Start new project
              </Link>
            </div>

            {contractors.length === 0 ? (
              <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
                <h2 className="text-xl font-black">
                  No contractors listed yet
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Contractor profiles will appear here after companies complete
                  onboarding.
                </p>
              </section>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {contractors.map((contractor) => (
                  <ContractorCard
                    key={contractor.user_id}
                    contractor={contractor}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function ContractorCard({ contractor }: { contractor: any }) {
  const company = contractor.company_name ?? 'Contractor';

  const categories = ((contractor.contractor_categories ?? []) as any[])
    .map((row) => firstRow<any>(row.categories)?.name)
    .filter(Boolean);

  const areas = ((contractor.contractor_service_areas ?? []) as any[])
    .map((row) => row.zip_code)
    .filter(Boolean);

  const rating =
    contractor.rating_count > 0
      ? Number(contractor.rating_avg).toFixed(1)
      : null;

  return (
    <Link
      href={`/dashboard/contractors/${contractor.user_id}`}
      className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-orange-200 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#071631] text-sm font-black text-orange-100">
          {contractor.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={contractor.logo_url}
              alt={company}
              className="h-full w-full object-cover"
            />
          ) : (
            initials(company)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-black group-hover:text-[#f45112]">
              {company}
            </h2>

            {contractor.verified && <Badge tone="success">Verified</Badge>}
          </div>

          <p className="mt-1 text-xs font-bold text-slate-500">
            {rating
              ? `★ ${rating} (${contractor.rating_count} reviews)`
              : 'New contractor'}
            {contractor.years_in_business
              ? ` · ${contractor.years_in_business} yrs`
              : ''}
          </p>
        </div>
      </div>

      {contractor.bio && (
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
          {contractor.bio}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {categories.slice(0, 3).map((name) => (
          <span
            key={name}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700"
          >
            {name}
          </span>
        ))}

        {categories.length > 3 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">
            +{categories.length - 3}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniStat
          label="Completed"
          value={String(contractor.completed_jobs_count ?? 0)}
        />

        <MiniStat
          label="Service ZIPs"
          value={String(areas.length)}
        />
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3 text-xs font-bold text-slate-500">
        View profile and start a structured offer →
      </div>
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-lg font-black text-slate-900">
        {value}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}