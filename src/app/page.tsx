import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/env';
import type { Category } from '@/lib/types';
import { formatRange, relativeTime } from '@/lib/utils';
import { LandingSearch } from '@/components/LandingSearch';

const fallbackCategories: Category[] = [
  {
    id: 'kitchen',
    slug: 'kitchen',
    name: 'Kitchen Remodel',
    description: 'Cabinets, counters, layout, lighting',
    icon: 'kitchen',
    sort_order: 10,
  },
  {
    id: 'bathroom',
    slug: 'bathroom',
    name: 'Bathroom Remodel',
    description: 'Tile, vanity, shower, waterproofing',
    icon: 'bath',
    sort_order: 20,
  },
  {
    id: 'roofing',
    slug: 'roofing',
    name: 'Roofing',
    description: 'Repair, replacement, inspections',
    icon: 'roof',
    sort_order: 30,
  },
  {
    id: 'flooring',
    slug: 'flooring',
    name: 'Flooring',
    description: 'Hardwood, tile, vinyl, refinishing',
    icon: 'flooring',
    sort_order: 40,
  },
  {
    id: 'painting',
    slug: 'painting',
    name: 'Painting',
    description: 'Interior, exterior, cabinets, trim',
    icon: 'paint',
    sort_order: 50,
  },
  {
    id: 'basement',
    slug: 'basement',
    name: 'Basement Finishing',
    description: 'Build-outs, drywall, flooring, baths',
    icon: 'basement',
    sort_order: 110,
  },
];

const cities = ['New York', 'Austin', 'Chicago', 'Miami', 'Los Angeles', 'Seattle'];

const trustStats = [
  ['Protected', 'checkout before direct chat'],
  ['Structured', 'offers, scope and timeline'],
  ['Escrow', 'payment held until completion'],
];

type ContractorMatch = {
  id: string;
  title: string;
  zip_code: string;
  city: string | null;
  state: string | null;
  created_at: string;
  square_footage: number | null;
  budget_min: number | null;
  budget_max: number | null;
  ai_estimate_min: number | null;
  ai_estimate_max: number | null;
  categories?: { name: string } | { name: string }[] | null;
};

type HomeStats = {
  activeProjects: number;
  pendingOffers: number;
  checkoutRequired: number;
  openOffers: number;
  activeJobs: number;
};

export default async function LandingPage() {
  let categories: Category[] = fallbackCategories;
  let signedInRole: 'homeowner' | 'contractor' | 'admin' | null = null;
  let signedInName: string | null = null;
  let contractorMatches: ContractorMatch[] = [];
  let isAuthed = false;

  let homeStats: HomeStats = {
    activeProjects: 0,
    pendingOffers: 0,
    checkoutRequired: 0,
    openOffers: 0,
    activeJobs: 0,
  };

  if (hasSupabaseEnv()) {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      isAuthed = true;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle();

      signedInRole =
  (profile?.role as 'homeowner' | 'contractor' | 'admin' | undefined) ?? null;

      signedInName = profile?.full_name ?? null;

if (signedInRole === 'admin') {
  return redirect('/admin');
}

      if (signedInRole === 'homeowner') {
  const activeProjectStatuses = [
    'open',
    'in_review',
    'quoted', // legacy support
    'negotiating',
    'pending_payment',
    'awarded', // legacy support
    'paid',
    'in_progress',
  ];

  const { data: homeownerProjects, error: homeownerProjectsError } =
    await supabase
      .from('projects')
      .select('id, status')
      .eq('homeowner_id', user.id);

  if (homeownerProjectsError) {
    console.error('Homeowner projects stats error:', homeownerProjectsError);
  }

  const homeownerProjectRows = homeownerProjects ?? [];

  const homeownerProjectIds = homeownerProjectRows
    .map((project: any) => project.id)
    .filter(Boolean);

  const activeProjectsCount = homeownerProjectRows.filter((project: any) =>
    activeProjectStatuses.includes(String(project.status)),
  ).length;

  let pendingOffersCount = 0;
  let checkoutRequiredCount = 0;

  if (homeownerProjectIds.length) {
    const [
      { count: pendingOfferRows, error: pendingOffersError },
      { count: checkoutRows, error: checkoutError },
    ] = await Promise.all([
      supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .in('project_id', homeownerProjectIds)
        .eq('status', 'pending')
        .eq('sender_role', 'contractor'),

      supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .in('id', homeownerProjectIds)
        .eq('status', 'pending_payment'),
    ]);

    if (pendingOffersError) {
      console.error('Pending offers stats error:', pendingOffersError);
    }

    if (checkoutError) {
      console.error('Checkout required stats error:', checkoutError);
    }

    pendingOffersCount = pendingOfferRows ?? 0;
    checkoutRequiredCount = checkoutRows ?? 0;
  }

  homeStats = {
    ...homeStats,
    activeProjects: activeProjectsCount,
    pendingOffers: pendingOffersCount,
    checkoutRequired: checkoutRequiredCount,
  };
}

      if (signedInRole === 'contractor') {
        const { count: openOffersCount, error: openOffersError } = await supabase
  .from('offers')
  .select('id', { count: 'exact', head: true })
  .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
  .eq('status', 'pending');

if (openOffersError) {
  console.error('Contractor open offers stats error:', openOffersError);
}

const { data: contractorDealOffers, error: contractorDealOffersError } =
  await supabase
    .from('offers')
    .select('id, project_id, status, sender_id, recipient_id')
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`);

if (contractorDealOffersError) {
  console.error('Contractor deal offers stats error:', contractorDealOffersError);
}

const contractorProjectIds = [
  ...new Set(
    (contractorDealOffers ?? [])
      .map((offer: any) => offer.project_id)
      .filter(Boolean),
  ),
];

let activeJobsCount = 0;

if (contractorProjectIds.length) {
  const { count, error: activeJobsError } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .in('id', contractorProjectIds)
    .in('status', [
      'pending_payment',
      'paid',
      'in_progress',
      'completed',
    ]);

  if (activeJobsError) {
    console.error('Contractor active jobs projects error:', activeJobsError);
  }

  activeJobsCount = count ?? 0;
}

homeStats = {
  ...homeStats,
  openOffers: openOffersCount ?? 0,
  activeJobs: activeJobsCount,
};

        const [{ data: serviceAreas }, { data: servedCategories }] =
          await Promise.all([
            supabase
              .from('contractor_service_areas')
              .select('zip_code, city, state')
              .eq('contractor_id', user.id),
            supabase
              .from('contractor_categories')
              .select('category_id')
              .eq('contractor_id', user.id),
          ]);

        const categoryIds = (servedCategories ?? [])
          .map((row: any) => row.category_id)
          .filter(Boolean);

        const zips = (serviceAreas ?? [])
          .map((row: any) => row.zip_code)
          .filter(Boolean);

        const cityAreas = (serviceAreas ?? []).filter(
          (row: any) => row.city && row.state,
        );

        if (categoryIds.length) {
          const { data: projects } = await supabase
            .from('projects')
            .select(`
              id,
              title,
              zip_code,
              city,
              state,
              created_at,
              square_footage,
              budget_min,
              budget_max,
              ai_estimate_min,
              ai_estimate_max,
              category_id,
              categories(name)
            `)
            .eq('status', 'open')
            .in('category_id', categoryIds)
            .order('created_at', { ascending: false })
            .limit(50);

          contractorMatches = ((projects ?? []) as ContractorMatch[]).filter(
            (project: any) =>
              zips.includes(project.zip_code) ||
              cityAreas.some((area: any) => sameArea(area, project)),
          );
        }
      }
    }

    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    categories = (data as Category[] | null) ?? fallbackCategories;
  }

  if (signedInRole) {
    return (
      <SignedInHome
        role={signedInRole}
        name={signedInName}
        matches={contractorMatches}
        stats={homeStats}
      />
    );
  }

  return (
    <main className="bg-white text-slate-900">
      <section className="border-b border-slate-200 bg-white text-slate-900">
        <div className="mx-auto grid min-h-[640px] max-w-7xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:py-14">
          <div>
            <div className="inline-flex rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-sm font-black text-[#f45112]">
              Protected renovation marketplace
            </div>

            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-tight tracking-tight text-slate-900 md:text-6xl">
              Compare contractor offers before you ever open direct chat.
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              bidAI helps homeowners create renovation projects, receive
              structured contractor offers, compare scope side by side, and
              complete checkout before direct messaging unlocks.
            </p>

            <LandingSearch
              categories={categories.map((c) => ({
                slug: c.slug,
                name: c.name,
              }))}
              isAuthed={isAuthed}
            />

            <div className="mt-7 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span className="font-black text-slate-900">Popular:</span>

              {[
                { label: 'Bathroom remodel', slug: 'bathroom' },
                { label: 'Roof repair', slug: 'roofing' },
                { label: 'Flooring', slug: 'flooring' },
                { label: 'Interior paint', slug: 'painting' },
              ].map((item) => (
                <Link
                  key={item.slug}
                  href={prefillHref({ category: item.slug }, isAuthed)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85"
                alt="Modern renovated home interior"
                className="h-[360px] w-full object-cover"
              />

              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-slate-500">
                      Kitchen remodel in Austin, TX
                    </div>

                    <div className="mt-1 text-2xl font-black">
                      $24,000 - $39,000
                    </div>
                  </div>

                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                    AI estimate
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {trustStats.map(([value, label]) => (
                    <div key={label} className="rounded-lg bg-slate-50 p-3">
                      <div className="text-lg font-black">{value}</div>
                      <div className="mt-1 text-xs leading-4 text-slate-500">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50 px-4 py-3">
                  <div className="text-xs font-black uppercase tracking-wide text-[#c94106]">
                    Marketplace flow
                  </div>

                  <p className="mt-1 text-sm leading-6 text-orange-900/80">
                    Structured offers first. Secure checkout second. Direct chat
                    unlocks after payment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black">Browse renovation services</h2>

            <p className="mt-2 text-slate-600">
              Start with a category, add project details, then compare
              structured contractor offers in one place.
            </p>
          </div>

          <Link
            href={prefillHref({}, isAuthed)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black shadow-sm transition hover:bg-slate-50"
          >
            See all services
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.slice(0, 6).map((category) => (
            <Link
              key={category.id}
              href={prefillHref({ category: category.slug }, isAuthed)}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 transition hover:border-orange-200 hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-lg bg-orange-50 text-lg font-black text-[#f45112]">
                  {category.name.slice(0, 1)}
                </span>

                <div>
                  <h3 className="font-black group-hover:text-[#f45112]">
                    {category.name}
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {category.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 lg:grid-cols-2">
          <AudienceCard
            title="For homeowners"
            detail="Create a project, get a rough AI estimate, receive structured offers, negotiate safely, and complete checkout before direct chat opens."
            href="/signup?role=homeowner"
            cta="Start a project"
            items={[
              'AI rough cost estimate',
              'Structured contractor offers',
              'Checkout before direct messaging',
            ]}
          />

          <AudienceCard
            title="For contractors"
            detail="Build your company profile, select service areas, review matched projects, and send clear offers with scope, timeline, and price."
            href="/signup?role=contractor"
            cta="Join as a contractor"
            items={[
              'Matched project leads',
              'Offer pipeline',
              'Jobs, earnings and reviews',
            ]}
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <div>
            <h2 className="text-3xl font-black">
              Local contractors across major US markets
            </h2>

            <p className="mt-3 text-slate-600">
              Search by ZIP, city and renovation category. Contractors define
              service areas so homeowners get relevant matches.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((city) => (
              <Link
                key={city}
                href={prefillHref({ city }, isAuthed)}
                className="rounded-xl border border-slate-200 bg-white p-5 font-black shadow-sm shadow-slate-900/5 hover:border-orange-200"
              >
                {city}

                <div className="mt-1 text-sm font-semibold text-slate-500">
                  Find remodeling pros
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function SignedInHome({
  role,
  name,
  matches,
  stats,
}: {
  role: 'homeowner' | 'contractor';
  name: string | null;
  matches: ContractorMatch[];
  stats: HomeStats;
}) {
  const isContractor = role === 'contractor';
  const visibleMatches = matches.length ? matches : demoContractorMatches();

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">
      <section className="mx-auto max-w-7xl px-4 pb-14 pt-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div>
            <p className="text-sm font-black text-[#f45112]">
              {isContractor ? 'Contractor marketplace' : 'Homeowner marketplace'}
            </p>

            <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">
              {name ? `Welcome back, ${name.split(/\s+/)[0]}.` : 'Welcome back.'}
            </h1>

            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              {isContractor
                ? 'Review matched homeowner projects, send structured offers, and manage jobs after checkout.'
                : 'Create projects, compare contractor offers, checkout safely, then continue with direct chat.'}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={isContractor ? '/dashboard/contractor' : '/dashboard/homeowner/new'}
                className="rounded-xl bg-[#f45112] px-5 py-3 font-black text-white hover:bg-[#d94406]"
              >
                {isContractor ? 'See matched leads' : 'Start a new project'}
              </Link>

              <Link
                href={isContractor ? '/dashboard/contractor' : '/dashboard/homeowner'}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-900 hover:bg-slate-50"
              >
                {isContractor ? 'Open dashboard' : 'My dashboard'}
              </Link>

              <Link
                href="/dashboard/messages"
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-900 hover:bg-slate-50"
              >
                Deal rooms
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5">
            <div className="text-sm font-bold text-slate-500">
              {isContractor ? 'Today in your pipeline' : 'Your project center'}
            </div>

            <div className="mt-4 space-y-3">
              {(isContractor
                ? [
                    ['Matching leads', String(matches.length)],
                    ['Open offers', String(stats.openOffers)],
                    ['Active jobs', String(stats.activeJobs)],
                  ]
                : [
                    ['Active projects', String(stats.activeProjects)],
                    ['Pending offers', String(stats.pendingOffers)],
                    ['Checkout required', String(stats.checkoutRequired)],
                  ]
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg bg-slate-50 p-4"
                >
                  <span className="font-bold text-slate-600">{label}</span>
                  <span className="text-2xl font-black">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isContractor ? (
          <section className="mt-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">
                  Matched homeowner projects
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Open projects matching your service categories and coverage
                  area.
                </p>
              </div>

              <Link
                href="/dashboard/contractor"
                className="text-sm font-black text-[#f45112] hover:underline"
              >
                View all in dashboard
              </Link>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {visibleMatches.slice(0, 6).map((project) => (
                <Link
                  key={project.id}
                  href={
                    project.id.startsWith('demo')
                      ? '/dashboard/contractor'
                      : `/dashboard/contractor/projects/${project.id}`
                  }
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 transition hover:border-orange-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase text-[#f45112]">
                        {firstRow(project.categories)?.name ?? 'Renovation'}
                      </div>

                      <h3 className="mt-2 line-clamp-2 text-lg font-black">
                        {project.title}
                      </h3>
                    </div>

                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">
                      Open
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <ProjectMiniStat
                      label="Budget"
                      value={formatRange(project.budget_min, project.budget_max)}
                    />

                    <ProjectMiniStat
                      label="AI estimate"
                      value={formatRange(
                        project.ai_estimate_min,
                        project.ai_estimate_max,
                      )}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                    <span className="font-bold text-slate-500">
                      {project.city && project.state
                        ? `${project.city}, ${project.state}`
                        : `ZIP ${project.zip_code}`}
                    </span>

                    <span className="text-slate-400">
                      {relativeTime(project.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function ProjectMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-black">{value}</div>
    </div>
  );
}

function AudienceCard({
  title,
  detail,
  href,
  cta,
  items,
}: {
  title: string;
  detail: string;
  href: string;
  cta: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
      <h2 className="text-2xl font-black">{title}</h2>

      <p className="mt-3 leading-7 text-slate-600">{detail}</p>

      <div className="mt-5 grid gap-2">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700"
          >
            {item}
          </div>
        ))}
      </div>

      <Link
        href={href}
        className="mt-6 inline-block rounded-xl bg-[#f45112] px-5 py-3 text-sm font-black text-white hover:bg-[#d94406]"
      >
        {cta}
      </Link>
    </div>
  );
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function prefillHref(
  prefill: { category?: string; city?: string; zip?: string },
  isAuthed: boolean,
) {
  const params = new URLSearchParams();

  if (prefill.category) params.set('category', prefill.category);
  if (prefill.city) params.set('city', prefill.city);
  if (prefill.zip) params.set('zip', prefill.zip);

  const target = `/dashboard/homeowner/new${
    params.toString() ? `?${params.toString()}` : ''
  }`;

  if (isAuthed) return target;

  return `/login?next=${encodeURIComponent(target)}`;
}

function sameArea(area: any, project: any) {
  return (
    String(area.city).toLowerCase() === String(project.city).toLowerCase() &&
    String(area.state).toUpperCase() === String(project.state).toUpperCase()
  );
}

function demoContractorMatches(): ContractorMatch[] {
  return [
    {
      id: 'demo-match-1',
      title: 'Kitchen remodel with new cabinets and quartz counters',
      zip_code: '78704',
      city: 'Austin',
      state: 'TX',
      created_at: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
      square_footage: 260,
      budget_min: 22000,
      budget_max: 32000,
      ai_estimate_min: 24000,
      ai_estimate_max: 39000,
      categories: { name: 'Kitchen Remodel' },
    },
    {
      id: 'demo-match-2',
      title: 'Primary bathroom renovation, tile shower and vanity',
      zip_code: '78745',
      city: 'Austin',
      state: 'TX',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      square_footage: 140,
      budget_min: 12000,
      budget_max: 21000,
      ai_estimate_min: 14500,
      ai_estimate_max: 28000,
      categories: { name: 'Bathroom Remodel' },
    },
    {
      id: 'demo-match-3',
      title: 'Basement finishing with office and guest bath',
      zip_code: '60614',
      city: 'Chicago',
      state: 'IL',
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      square_footage: 520,
      budget_min: 30000,
      budget_max: 48000,
      ai_estimate_min: 34000,
      ai_estimate_max: 62000,
      categories: { name: 'Basement Finishing' },
    },
  ];
}