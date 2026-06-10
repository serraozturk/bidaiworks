import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatRange, relativeTime } from '@/lib/utils';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { MakeOfferButton } from '@/components/MakeOfferButton';
import { countUnreadConversations } from '@/lib/unread';

type ProjectRow = {
  id: string;
  title: string;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  status: string;
  payment_status: string | null;
  ai_estimate_min: number | null;
  ai_estimate_max: number | null;
  created_at: string;
  desired_start_date: string | null;
  payment_due_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
  selected_offer_id: string | null;
  awarded_offer_id: string | null;
  categories: { name: string } | { name: string }[] | null;
};

type OfferRow = {
  id: string;
  project_id: string;
  conversation_id: string | null;
  sender_id: string;
  sender_role: 'homeowner' | 'contractor';
  recipient_id: string | null;
  recipient_role: 'homeowner' | 'contractor' | null;
  amount: number;
  timeline_days: number | null;
  status: string;
  created_at: string;
};

type ContractorRow = {
  user_id: string;
  company_name: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  verified: boolean | null;
  years_in_business: number | null;
  bio: string | null;
  services?: string | null;
  location?: string | null;
};

type ProjectStats = {
  projectId: string;
  views: number;
  messageContractors: number;
  offerCount: number;
  activeOfferCount: number;
  needsReviewCount: number;
  paymentPendingCount: number;
};

const ACTIVE_PROJECT_STATUSES = [
  'open',
  'in_review',
  'quoted',
  'negotiating',
  'pending_payment',
  'paid',
  'in_progress',
];

const NEGOTIATION_PROJECT_STATUSES = [
  'open',
  'in_review',
  'quoted',
  'negotiating',
];

const ACTIVE_OFFER_STATUSES = [
  'pending',
  'countered',
  'payment_pending',
  'accepted',
];

const fallbackContractors: ContractorRow[] = [
  {
    user_id: 'demo-c-1',
    company_name: 'Crown Renovations',
    rating_avg: 4.8,
    rating_count: 128,
    verified: true,
    years_in_business: 8,
    bio: 'Full-service kitchen and bathroom remodeling with premium craftsmanship.',
    services: 'Kitchen, Bath, Custom Cabinets',
    location: 'Austin, TX',
  },
  {
    user_id: 'demo-c-2',
    company_name: 'Firststone',
    rating_avg: 4.7,
    rating_count: 56,
    verified: true,
    years_in_business: 5,
    bio: 'Reliable timelines and detailed project execution for residential remodels.',
    services: 'Bath, Flooring, Remodeling',
    location: 'Round Rock, TX',
  },
  {
    user_id: 'demo-c-3',
    company_name: 'Urban Tile Studio',
    rating_avg: 4.7,
    rating_count: 76,
    verified: false,
    years_in_business: 6,
    bio: 'Tile, flooring, and finish specialists for modern remodel projects.',
    services: 'Tile, Flooring, Bath',
    location: 'Austin, TX',
  },
];

export default async function HomeownerDashboard() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [
    { data: profile, error: profileError },
    { data: projects, error: projectsError },
    { data: featuredContractors, error: contractorsError },
    messageCount,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle(),

    supabase
      .from('projects')
      .select(`
        id,
        title,
        zip_code,
        city,
        state,
        status,
        payment_status,
        ai_estimate_min,
        ai_estimate_max,
        created_at,
        desired_start_date,
        payment_due_at,
        paid_at,
        completed_at,
        selected_offer_id,
        awarded_offer_id,
        categories(name)
      `)
      .eq('homeowner_id', user.id)
      .order('created_at', { ascending: false }),

    supabase
      .from('contractor_profiles')
      .select(`
        user_id,
        company_name,
        rating_avg,
        rating_count,
        verified,
        years_in_business,
        bio
      `)
      .order('rating_avg', { ascending: false })
      .order('rating_count', { ascending: false })
      .limit(6),

    countUnreadConversations(supabase, user.id, 'homeowner'),
  ]);

  if (profileError) {
    console.error('Homeowner profile query error:', profileError);
  }

  if (projectsError) {
    console.error('Homeowner projects query error:', projectsError);
    throw new Error(projectsError.message);
  }

  if (contractorsError) {
    console.error('Featured contractors query error:', contractorsError);
  }

  const projectRows = (projects ?? []) as ProjectRow[];
  const projectIds = projectRows.map((project) => project.id);

  const offers = await getProjectOffers(supabase, projectIds);
  const statsByProjectId = await getProjectStats(supabase, projectIds, offers);

  const firstName = profile?.full_name?.split(/\s+/)[0] || 'there';

  const activeProjects = projectRows.filter((project) =>
    ACTIVE_PROJECT_STATUSES.includes(project.status),
  );

  const pendingPaymentProjects = projectRows.filter(
    (project) => project.status === 'pending_payment',
  );

  const needsReviewProjects = projectRows.filter((project) => {
    const stats = statsByProjectId.get(project.id);

    return Boolean(stats && stats.needsReviewCount > 0);
  });

  const openOfferCount = Array.from(statsByProjectId.values()).reduce(
    (sum, stats) => sum + stats.activeOfferCount,
    0,
  );

  const totalOfferCount = offers.length;

  const preferredProjectForOffer =
    projectRows.find((project) =>
      NEGOTIATION_PROJECT_STATUSES.includes(project.status),
    ) ?? projectRows[0] ?? null;

  const latestProjects = projectRows.slice(0, 6);

  const contractors: ContractorRow[] = featuredContractors?.length
    ? (featuredContractors as ContractorRow[]).map((contractor, index) => ({
        ...contractor,
        services:
          fallbackContractors[index % fallbackContractors.length]?.services ??
          'Kitchen, Bath, Remodeling',
        location:
          fallbackContractors[index % fallbackContractors.length]?.location ??
          'Local area',
      }))
    : fallbackContractors;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role="homeowner"
          active="dashboard"
          messageCount={messageCount ?? 0}
          offerCount={openOfferCount}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1480px] px-5 py-5">
            <header className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
              <div className="border-b border-slate-200 bg-white px-6 py-7 text-slate-900">
                <div className="flex flex-wrap items-end justify-between gap-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f45112]">
                      Homeowner dashboard
                    </p>

                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                      Welcome back, {firstName}
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Manage projects, compare contractor offers, continue checkout
                      and keep every negotiation inside bidAI.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/dashboard/messages"
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      Deal rooms
                    </Link>

                    <Link
                      href="/dashboard/homeowner/new"
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-[#f45112] px-4 text-sm font-black text-white transition hover:bg-[#d94406]"
                    >
                      New project
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid border-t border-slate-200 bg-white md:grid-cols-4">
                <HeroMetric
                  label="Projects"
                  value={String(projectRows.length)}
                  detail="Total created"
                />

                <HeroMetric
                  label="Active"
                  value={String(activeProjects.length)}
                  detail="Open or booked"
                />

                <HeroMetric
                  label="Offers"
                  value={String(totalOfferCount)}
                  detail="All received/sent"
                />

                <HeroMetric
                  label="Needs review"
                  value={String(needsReviewProjects.length)}
                  detail="Contractor waiting"
                  accent
                />
              </div>
            </header>

            {pendingPaymentProjects.length > 0 && (
              <section className="mb-5 rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-sm shadow-slate-900/5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-orange-700">
                      Checkout required
                    </div>

                    <h2 className="mt-1 text-lg font-black text-orange-950">
                      {pendingPaymentProjects.length} project
                      {pendingPaymentProjects.length === 1 ? '' : 's'} waiting for payment
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-orange-900/80">
                      The contractor is not booked until checkout is completed.
                      Payment stays protected in bidAI escrow.
                    </p>
                  </div>

                  <Link
                    href={`/dashboard/checkout/project/${pendingPaymentProjects[0].id}`}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#f4510b] px-4 text-sm font-black text-white transition hover:bg-[#d94406]"
                  >
                    Continue checkout
                  </Link>
                </div>
              </section>
            )}

            <section className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_420px]">
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
                <SectionHeader
                  title="Your projects"
                  subtitle="Latest projects, offer activity and next steps."
                  action={
                    <Link
                      href="/dashboard/homeowner/new"
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      Add project
                    </Link>
                  }
                />

                {projectRows.length === 0 ? (
                  <EmptyProjects />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {latestProjects.map((project) => (
                      <ProjectLine
                        key={project.id}
                        project={project}
                        stats={
                          statsByProjectId.get(project.id) ?? {
                            projectId: project.id,
                            views: 0,
                            messageContractors: 0,
                            offerCount: 0,
                            activeOfferCount: 0,
                            needsReviewCount: 0,
                            paymentPendingCount: 0,
                          }
                        }
                      />
                    ))}
                  </div>
                )}

                {projectRows.length > latestProjects.length && (
                  <div className="border-t border-slate-100 px-5 py-3 text-right">
                    <Link
                      href="/dashboard/homeowner/compare"
                      className="text-xs font-black text-[#f4510b] hover:underline"
                    >
                      View all projects and offers →
                    </Link>
                  </div>
                )}
              </section>

              <aside className="space-y-5">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Next best action
                  </div>

                  {needsReviewProjects.length > 0 ? (
                    <>
                      <h2 className="mt-2 text-lg font-black text-[#0f172a]">
                        Review new contractor offers
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Some contractors are waiting for your accept, decline or
                        counter-offer decision.
                      </p>

                      <Link
                        href={`/dashboard/homeowner/compare?project=${needsReviewProjects[0].id}`}
                        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#f45112] px-4 text-sm font-black text-white transition hover:bg-[#d94406]"
                      >
                        Compare offers
                      </Link>
                    </>
                  ) : pendingPaymentProjects.length > 0 ? (
                    <>
                      <h2 className="mt-2 text-lg font-black text-[#0f172a]">
                        Finish checkout
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Complete payment to book the selected contractor and unlock
                        direct chat.
                      </p>

                      <Link
                        href={`/dashboard/checkout/project/${pendingPaymentProjects[0].id}`}
                        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#f4510b] px-4 text-sm font-black text-white transition hover:bg-[#d94406]"
                      >
                        Continue checkout
                      </Link>
                    </>
                  ) : projectRows.length === 0 ? (
                    <>
                      <h2 className="mt-2 text-lg font-black text-[#0f172a]">
                        Create your first project
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Add scope, ZIP, photos and budget to start receiving
                        contractor offers.
                      </p>

                      <Link
                        href="/dashboard/homeowner/new"
                        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#f4510b] px-4 text-sm font-black text-white transition hover:bg-[#d94406]"
                      >
                        New project
                      </Link>
                    </>
                  ) : (
                    <>
                      <h2 className="mt-2 text-lg font-black text-[#0f172a]">
                        You are up to date
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        No urgent offer decisions right now. You can browse
                        contractors or create another project.
                      </p>

                      <Link
                        href="/dashboard/contractors"
                        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        Browse contractors
                      </Link>
                    </>
                  )}
                </section>

                <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm shadow-slate-900/5">
                  <div className="text-xs font-black uppercase tracking-wide text-amber-800">
                    Marketplace safety
                  </div>

                  <p className="mt-2 text-sm leading-6 text-amber-950/80">
                    Keep negotiation, scope changes and payments inside bidAI.
                    Direct chat unlocks after checkout is completed.
                  </p>
                </section>
              </aside>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
              <SectionHeader
                title="Recommended contractors"
                subtitle="Send a structured budget request before direct chat opens."
                action={
                  <Link
                    href="/dashboard/contractors"
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Browse all
                  </Link>
                }
              />

              <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                {contractors.map((contractor, index) => (
                  <ContractorCard
                    key={contractor.user_id ?? contractor.company_name}
                    contractor={contractor}
                    index={index}
                    project={preferredProjectForOffer}
                  />
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

function HeroMetric({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className="border-b border-slate-100 px-5 py-4 md:border-b-0 md:border-r md:last:border-r-0">
      <div
        className={[
          'text-[10px] font-black uppercase tracking-wide',
          accent ? 'text-[#f4510b]' : 'text-slate-500',
        ].join(' ')}
      >
        {label}
      </div>

      <div className="mt-1 text-2xl font-black text-[#0f172a]">
        {value}
      </div>

      <div className="mt-0.5 text-xs font-semibold text-slate-500">
        {detail}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-black text-[#0f172a]">
          {title}
        </h2>

        <p className="mt-0.5 text-xs text-slate-500">
          {subtitle}
        </p>
      </div>

      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Projects                                                                    */
/* -------------------------------------------------------------------------- */

function ProjectLine({
  project,
  stats,
}: {
  project: ProjectRow;
  stats: ProjectStats;
}) {
  const category = categoryName(project.categories) ?? 'Renovation';
  const status = projectStatusConfig(project.status);

  const projectHref = `/dashboard/homeowner/projects/${project.id}`;
  const compareHref = `/dashboard/homeowner/compare?project=${project.id}`;
  const checkoutHref = `/dashboard/checkout/project/${project.id}`;

  const canCompare =
    NEGOTIATION_PROJECT_STATUSES.includes(project.status) &&
    stats.offerCount > 0;

  const needsCheckout = project.status === 'pending_payment';
  const isActive = ['paid', 'in_progress'].includes(project.status);
  const isCompleted = project.status === 'completed';

  return (
    <article className="grid gap-4 px-5 py-4 transition hover:bg-slate-50 xl:grid-cols-[minmax(0,1.4fr)_120px_120px_120px_190px] xl:items-center">
      <Link href={projectHref} className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-base font-black text-[#0f172a]">
            {project.title}
          </h3>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        <p className="mt-1 truncate text-xs font-semibold text-slate-500">
          {category}
          {project.zip_code ? ` · ZIP ${project.zip_code}` : ''}
          {project.city ? ` · ${project.city}` : ''}
          {project.state ? `, ${project.state}` : ''}
        </p>

        <p className="mt-1 text-[11px] font-medium text-slate-400">
          Created {relativeTime(project.created_at)}
          {project.paid_at ? ` · Paid ${relativeTime(project.paid_at)}` : ''}
          {project.completed_at
            ? ` · Completed ${relativeTime(project.completed_at)}`
            : ''}
        </p>
      </Link>

      <MiniColumn
        label="AI estimate"
        value={formatRange(project.ai_estimate_min, project.ai_estimate_max)}
      />

      <MiniColumn
        label="Offers"
        value={`${stats.activeOfferCount}/${stats.offerCount}`}
        highlight={stats.needsReviewCount > 0}
      />

      <MiniColumn
        label="Start"
        value={startLabel(project)}
      />

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={projectHref}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
        >
          {isActive ? 'Track' : isCompleted ? 'Summary' : 'Details'}
        </Link>

        {needsCheckout ? (
          <Link
            href={checkoutHref}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f4510b] px-3 text-xs font-black text-white transition hover:bg-[#d94406]"
          >
            Checkout
          </Link>
        ) : canCompare ? (
          <Link
            href={compareHref}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f45112] px-3 text-xs font-black text-white transition hover:bg-[#d94406]"
          >
            Compare
          </Link>
        ) : (
          <Link
            href="/dashboard/messages"
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f45112] px-3 text-xs font-black text-white transition hover:bg-[#d94406]"
          >
            Rooms
          </Link>
        )}
      </div>
    </article>
  );
}

function MiniColumn({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-lg border px-3 py-2 xl:border-0 xl:bg-transparent xl:p-0',
        highlight
          ? 'border-orange-200 bg-orange-50 xl:text-orange-700'
          : 'border-slate-200 bg-slate-50',
      ].join(' ')}
    >
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div
        className={[
          'mt-0.5 truncate text-xs font-black',
          highlight ? 'text-orange-700' : 'text-[#0f172a]',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyProjects() {
  return (
    <div className="px-5 py-14 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-orange-50 text-xl font-black text-[#f4510b]">
        +
      </div>

      <h3 className="mt-4 text-base font-black text-[#0f172a]">
        No projects yet
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Create your first project to get contractor matches, AI-powered estimates
        and structured offers.
      </p>

      <Link
        href="/dashboard/homeowner/new"
        className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-[#f4510b] px-4 text-sm font-black text-white transition hover:bg-[#d94406]"
      >
        Create project
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Contractors                                                                 */
/* -------------------------------------------------------------------------- */

function ContractorCard({
  contractor,
  index,
  project,
}: {
  contractor: ContractorRow;
  index: number;
  project: ProjectRow | null;
}) {
  const company = contractor.company_name ?? 'Contractor';

  const rating = contractor.rating_count
    ? Number(contractor.rating_avg).toFixed(1)
    : 'New';

  const reviews = contractor.rating_count ?? 0;

  const services = String(contractor.services ?? 'Renovation')
    .split(',')
    .map((service) => service.trim())
    .filter(Boolean)
    .slice(0, 3);

  const isReal =
    typeof contractor.user_id === 'string' &&
    !contractor.user_id.startsWith('demo-');

  const canSendProjectOffer =
    Boolean(project?.id) &&
    isReal &&
    project &&
    NEGOTIATION_PROJECT_STATUSES.includes(project.status);

  const canOpenChat =
    Boolean(project?.id) &&
    isReal &&
    project &&
    ['paid', 'in_progress', 'completed'].includes(project.status);

  const needsCheckout = project?.status === 'pending_payment';

  const tones = [
    'bg-[#06152e] text-orange-100',
    'bg-[#1c1917] text-amber-100',
    'bg-[#134e4a] text-teal-100',
  ];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-xs font-black ${tones[index % tones.length]}`}
        >
          {initials(company)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-black text-[#0f172a]">
              {company}
            </h3>

            {contractor.verified && (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                Verified
              </span>
            )}
          </div>

          <p className="mt-0.5 text-xs font-bold text-slate-500">
            ★ {rating} · {reviews} reviews
            {contractor.years_in_business
              ? ` · ${contractor.years_in_business} yrs`
              : ''}
          </p>

          <p className="mt-0.5 text-xs text-slate-500">
            {contractor.location ?? 'Local area'}
          </p>
        </div>
      </div>

      {contractor.bio && (
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">
          {contractor.bio}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {services.map((service) => (
          <span
            key={service}
            className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600"
          >
            {service}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href="/dashboard/contractors"
          className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
        >
          Profile
        </Link>

        {canSendProjectOffer ? (
          <MakeOfferButton
            projectId={project?.id ?? null}
            projectTitle={project?.title ?? null}
            contractorId={contractor.user_id}
            contractorCompany={company}
            contractorRating={contractor.rating_avg ?? null}
            contractorReviewCount={contractor.rating_count ?? null}
            contractorVerified={Boolean(contractor.verified)}
            contractorBio={contractor.bio ?? null}
            contractorServices={contractor.services ?? null}
            label="Ask with budget"
            className="h-9 rounded-xl px-3 text-xs font-black"
          />
        ) : canOpenChat ? (
          <Link
            href={`/dashboard/messages/${project?.id}/${contractor.user_id}`}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f45112] px-3 text-xs font-black text-white transition hover:bg-[#d94406]"
          >
            Open chat
          </Link>
        ) : needsCheckout && project?.id ? (
          <Link
            href={`/dashboard/checkout/project/${project.id}`}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f4510b] px-3 text-xs font-black text-white transition hover:bg-[#d94406]"
          >
            Checkout first
          </Link>
        ) : (
          <Link
            href="/dashboard/homeowner/new"
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f45112] px-3 text-xs font-black text-white transition hover:bg-[#d94406]"
          >
            Create project
          </Link>
        )}
      </div>

      {canSendProjectOffer && (
        <p className="mt-2 text-[11px] leading-4 text-slate-500">
          Send scope, budget, included work and exclusions before direct chat opens.
        </p>
      )}

      {needsCheckout && (
        <p className="mt-2 text-[11px] leading-4 text-slate-500">
          Direct chat will open after checkout is completed.
        </p>
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Data helpers                                                                */
/* -------------------------------------------------------------------------- */

async function getProjectOffers(
  supabase: ReturnType<typeof createClient>,
  projectIds: string[],
): Promise<OfferRow[]> {
  if (projectIds.length === 0) return [];

  const { data, error } = await supabase
    .from('offers')
    .select(`
      id,
      project_id,
      conversation_id,
      sender_id,
      sender_role,
      recipient_id,
      recipient_role,
      amount,
      timeline_days,
      status,
      created_at
    `)
    .in('project_id', projectIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Homeowner dashboard offers query error:', error);
    throw new Error(error.message);
  }

  return (data ?? []) as OfferRow[];
}

async function getProjectStats(
  supabase: ReturnType<typeof createClient>,
  projectIds: string[],
  offers: OfferRow[],
): Promise<Map<string, ProjectStats>> {
  const map = new Map<string, ProjectStats>();

  for (const projectId of projectIds) {
    const projectOffers = offers.filter((offer) => offer.project_id === projectId);

    map.set(projectId, {
      projectId,
      views: 0,
      messageContractors: 0,
      offerCount: projectOffers.length,
      activeOfferCount: projectOffers.filter((offer) =>
        ACTIVE_OFFER_STATUSES.includes(offer.status),
      ).length,
      needsReviewCount: projectOffers.filter((offer) =>
        isHomeownerTurn(offer),
      ).length,
      paymentPendingCount: projectOffers.filter(
        (offer) => offer.status === 'payment_pending',
      ).length,
    });
  }

  if (projectIds.length === 0) return map;

  const [{ data: conversations }, { data: views, error: viewsError }] =
    await Promise.all([
      supabase
        .from('conversations')
        .select('project_id, contractor_id')
        .in('project_id', projectIds),

      supabase
        .from('project_views')
        .select('project_id, contractor_id')
        .in('project_id', projectIds),
    ]);

  const viewedContractorsByProject = new Map<string, Set<string>>();
  const messageContractorsByProject = new Map<string, Set<string>>();

  for (const projectId of projectIds) {
    viewedContractorsByProject.set(projectId, new Set<string>());
    messageContractorsByProject.set(projectId, new Set<string>());
  }

  if (!viewsError) {
    for (const view of views ?? []) {
      if (!view.project_id || !view.contractor_id) continue;

      const set =
        viewedContractorsByProject.get(view.project_id) ?? new Set<string>();

      set.add(view.contractor_id);
      viewedContractorsByProject.set(view.project_id, set);
    }
  }

  for (const conversation of conversations ?? []) {
    if (!conversation.project_id || !conversation.contractor_id) continue;

    const messageSet =
      messageContractorsByProject.get(conversation.project_id) ??
      new Set<string>();

    messageSet.add(conversation.contractor_id);
    messageContractorsByProject.set(conversation.project_id, messageSet);

    const viewSet =
      viewedContractorsByProject.get(conversation.project_id) ??
      new Set<string>();

    viewSet.add(conversation.contractor_id);
    viewedContractorsByProject.set(conversation.project_id, viewSet);
  }

  for (const projectId of projectIds) {
    const existing = map.get(projectId);

    if (!existing) continue;

    const viewSet = viewedContractorsByProject.get(projectId) ?? new Set<string>();
    const messageSet =
      messageContractorsByProject.get(projectId) ?? new Set<string>();

    map.set(projectId, {
      ...existing,
      views: viewSet.size,
      messageContractors: messageSet.size,
    });
  }

  return map;
}

/* -------------------------------------------------------------------------- */
/* General helpers                                                             */
/* -------------------------------------------------------------------------- */

function isHomeownerTurn(offer: OfferRow): boolean {
  return (
    ['pending', 'countered'].includes(offer.status) &&
    offer.sender_role === 'contractor'
  );
}

function startLabel(project: ProjectRow): string {
  if (project.desired_start_date) {
    return formatShortDate(project.desired_start_date);
  }

  if (project.status === 'paid' || project.status === 'in_progress') {
    return 'Ready';
  }

  if (project.status === 'pending_payment') {
    return 'After pay';
  }

  return 'Flexible';
}

function projectStatusConfig(status: string): {
  label: string;
  className: string;
} {
  if (status === 'open') {
    return {
      label: 'Open',
      className: 'bg-blue-100 text-blue-700',
    };
  }

  if (status === 'in_review' || status === 'quoted' || status === 'negotiating') {
    return {
      label: 'Negotiating',
      className: 'bg-amber-100 text-amber-800',
    };
  }

  if (status === 'pending_payment') {
    return {
      label: 'Payment required',
      className: 'bg-orange-100 text-orange-700',
    };
  }

  if (status === 'paid') {
    return {
      label: 'Awaiting contractor',
      className: 'bg-violet-100 text-violet-700',
    };
  }

  if (status === 'in_progress') {
    return {
      label: 'In progress',
      className: 'bg-emerald-100 text-emerald-700',
    };
  }

  if (status === 'completed') {
    return {
      label: 'Completed',
      className: 'bg-slate-200 text-slate-700',
    };
  }

  if (status === 'cancelled') {
    return {
      label: 'Cancelled',
      className: 'bg-slate-200 text-slate-600',
    };
  }

  if (status === 'expired') {
    return {
      label: 'Expired',
      className: 'bg-slate-200 text-slate-600',
    };
  }

  return {
    label: status.replaceAll('_', ' '),
    className: 'bg-slate-100 text-slate-700',
  };
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function categoryName(value: any): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value.name ?? null;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}