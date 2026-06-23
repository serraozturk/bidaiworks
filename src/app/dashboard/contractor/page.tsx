export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import LeadsFilter, { type ContractorLead } from './leads-filter';
import { formatCurrency, relativeTime } from '@/lib/utils';
import { countUnreadConversations } from '@/lib/unread';

const stockImages = [
  'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1521783988139-89397d761dce?auto=format&fit=crop&w=900&q=80',
];

export default async function ContractorDashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Recover any stale payment / commitment windows before rendering.
  await supabase.rpc('expire_stale_deals').then(() => undefined, () => undefined);

  const [{ data: profile }, { data: contractorProfile }] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single(),

    supabase
      .from('contractor_profiles')
      .select('company_name, verification_status, rejection_reason')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  // Note: role + verification checks are handled by layout.tsx

  const [
    { data: serviceAreas },
    { data: contractorCategories },
    { data: myOffers },
    { data: paymentRows },
    conversationCount,
  ] = await Promise.all([
    supabase
      .from('contractor_service_areas')
      .select('zip_code, city, state')
      .eq('contractor_id', user.id),

    supabase
      .from('contractor_categories')
      .select('category_id')
      .eq('contractor_id', user.id),

    supabase
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
        created_at,
        contractor_fee_amount,
        contractor_fee_status,
        projects(
          id,
          title,
          status,
          payment_status,
          zip_code,
          homeowner_id,
          categories(name)
        )
      `)
      .or(
        `sender_id.eq.${user.id},and(recipient_id.eq.${user.id},recipient_role.eq.contractor)`,
      )
      .order('created_at', { ascending: false }),

    supabase
      .from('payments')
      .select(`
        id,
        project_id,
        offer_id,
        project_amount,
        contractor_payout_amount,
        contractor_fee_amount,
        deposit_amount,
        status,
        held_at,
        released_at,
        created_at,
        projects(
          id,
          title,
          status,
          payment_status,
          paid_at,
          contractor_fee_status,
          contractor_commit_due_at,
          zip_code,
          homeowner_id,
          categories(name)
        ),
        offers(
          id,
          amount,
          timeline_days,
          status
        )
      `)
      .eq('payee_id', user.id)
      .order('created_at', { ascending: false }),

    countUnreadConversations(supabase, user.id, 'contractor'),
  ]);

  const categoryIds = (contractorCategories ?? []).map(
    (row: any) => row.category_id,
  );

  const zips = (serviceAreas ?? [])
    .map((row: any) => row.zip_code)
    .filter(Boolean);

  let realLeads: ContractorLead[] = [];

  if (categoryIds.length) {
    const { data: openProjects } = await supabase
      .from('projects')
      .select(`
        id,
        title,
        description,
        zip_code,
        city,
        state,
        budget_min,
        budget_max,
        created_at,
        homeowner_id,
        categories(name),
        project_photos(id)
      `)
      .eq('status', 'open')
      .in('category_id', categoryIds)
      .order('created_at', { ascending: false })
      .limit(20);

    realLeads = ((openProjects ?? []) as any[])
      .filter((project) => zips.length === 0 || zips.includes(project.zip_code))
      .map((project, index) => ({
        id: project.id,
        isDemo: false,
        title: project.title,
        description: project.description ?? 'No description provided.',
        zip_code: project.zip_code,
        city: project.city,
        state: project.state,
        category: categoryName(project.categories) ?? 'Renovation',
        budget_min: project.budget_min,
        budget_max: project.budget_max,
        start: relative(project.created_at, 'Posted'),
        response: 'New lead',
        size: sizeLabel(project.budget_max),
        photos: Array.isArray(project.project_photos)
          ? project.project_photos.length
          : 0,
        image: stockImages[index % stockImages.length],
        homeowner_id: project.homeowner_id,
      }));
  }

  const offerRows = (myOffers ?? []) as any[];
  const payments = (paymentRows ?? []) as any[];

  const openOfferRows = offerRows.filter((offer) =>
    ['pending', 'countered', 'payment_pending'].includes(offer.status),
  );

  const needsResponse = openOfferRows.filter(
    (offer) =>
      ['pending', 'countered'].includes(offer.status) &&
      offer.sender_role === 'homeowner',
  );

  // Homeowner paid but this contractor has not paid the commitment fee yet.
  const awaitingCommitment = payments.filter((payment) => {
    const project = firstRow<any>(payment.projects);
    return (
      payment.status === 'held' &&
      project &&
      project.status === 'paid' &&
      project.contractor_fee_status === 'due'
    );
  });

  // Jobs the contractor has committed to and are live.
  const activeJobs = payments.filter((payment) => {
    const project = firstRow<any>(payment.projects);
    return payment.status === 'held' && project && project.status === 'in_progress';
  });

  // Commitment fee is paid separately by the contractor; payout = full project amount.
  const escrowTotal = activeJobs.reduce((sum, payment) => {
    const offer = firstRow<any>(payment.offers);
    return sum + Number(payment.project_amount ?? offer?.amount ?? 0);
  }, 0);

  const latestActiveJobs = activeJobs.slice(0, 2);

  const leads: ContractorLead[] = realLeads.length ? realLeads : demoLeads();
  const usingDemos = realLeads.length === 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role="contractor"
          active="dashboard"
          messageCount={conversationCount ?? 0}
          offerCount={openOfferRows.length}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1480px] px-5 py-5">
            <header className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
              <div className="border-b border-slate-200 bg-white px-6 py-7 text-slate-900">
                <div className="flex flex-wrap items-end justify-between gap-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f45112]">
                      Contractor dashboard
                    </p>

                    <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                      {contractorProfile?.company_name ||
                        profile?.full_name ||
                        'Welcome'}
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Manage matching leads, active offers, paid jobs and escrow
                      from one place.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <TopLink href="/dashboard/contractor/offers">
                      Offer pipeline
                    </TopLink>

                    <TopLink href="/dashboard/contractor/jobs">
                      Active jobs
                    </TopLink>

                    <TopLink href="/dashboard/contractor/earnings">
                      Earnings
                    </TopLink>
                  </div>
                </div>
              </div>

              <div className="grid bg-white md:grid-cols-4">
                <HeaderMetric
                  label="Matching leads"
                  value={String(leads.length)}
                  detail={usingDemos ? 'Demo leads shown' : 'Live project requests'}
                />

                <HeaderMetric
                  label="Open offers"
                  value={String(openOfferRows.length)}
                  detail={
                    needsResponse.length
                      ? `${needsResponse.length} need response`
                      : 'No urgent response'
                  }
                  accent={needsResponse.length > 0}
                />

                <HeaderMetric
                  label="Active jobs"
                  value={String(activeJobs.length)}
                  detail={activeJobs.length ? 'Paid and in escrow' : 'No active jobs yet'}
                />

                <HeaderMetric
                  label="Escrow balance"
                  value={formatCurrency(escrowTotal)}
                  detail="Net amount currently held"
                />
              </div>
            </header>

            {needsResponse.length > 0 && (
              <section className="mb-5 rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-sm shadow-slate-900/5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-orange-700">
                      Action needed
                    </div>

                    <h2 className="mt-1 text-lg font-black text-orange-950">
                      {needsResponse.length} homeowner counter offer
                      {needsResponse.length === 1 ? '' : 's'} need your response
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-orange-900/80">
                      Open your offer pipeline or deal room to respond.
                    </p>
                  </div>

                  <Link
                    href="/dashboard/contractor/offers"
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#f4510b] px-4 text-sm font-black text-white transition hover:bg-[#d94406]"
                  >
                    Review offers
                  </Link>
                </div>
              </section>
            )}

            {awaitingCommitment.length > 0 && (
              <section className="mb-5 rounded-xl border border-orange-300 bg-orange-50 p-5 shadow-sm shadow-slate-900/5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-orange-700">
                      Claim your jobs
                    </div>

                    <h2 className="mt-1 text-lg font-black text-orange-950">
                      {awaitingCommitment.length} paid job
                      {awaitingCommitment.length === 1 ? '' : 's'} waiting for your
                      commitment fee
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-orange-900/80">
                      The homeowner has paid. Pay the 8% commitment fee within 48
                      hours to claim the job, unlock direct chat and start work -
                      otherwise it re-opens to other contractors.
                    </p>
                  </div>

                  <Link
                    href="/dashboard/contractor/jobs"
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#f45112] px-4 text-sm font-black text-white transition hover:bg-[#d94406]"
                  >
                    Review &amp; pay
                  </Link>
                </div>
              </section>
            )}

            <section className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section
                id="matching-projects"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5"
              >
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-black tracking-tight text-[#0f172a]">
                        Matching project requests
                      </h2>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {leads.length} matched
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {usingDemos
                        ? 'Add ZIP coverage and service categories to receive live matches.'
                        : 'Projects matching your categories and service areas.'}
                    </p>
                  </div>

                  <Link
                    href="/dashboard/contractor/profile"
                    className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Edit coverage
                  </Link>
                </div>

                <LeadsFilter leads={leads} />
              </section>

              <ActiveJobsBox jobs={latestActiveJobs} />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function ActiveJobsBox({ jobs }: { jobs: any[] }) {
  return (
    <aside className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
        <div>
          <h2 className="text-sm font-black text-[#0f172a]">Active jobs</h2>

          <p className="mt-0.5 text-[11px] text-slate-500">
            Paid work in progress
          </p>
        </div>

        <Link
          href="/dashboard/contractor/jobs"
          className="text-[11px] font-black text-[#f4510b] hover:underline"
        >
          View
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="px-4 py-8 text-sm leading-6 text-slate-500">
          No active paid jobs yet. Once a homeowner completes checkout, the job
          appears here.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {jobs.map((payment) => {
            const project = firstRow<any>(payment.projects);
            const offer = firstRow<any>(payment.offers);
            const daysLeft = getDaysLeft(project?.paid_at, offer?.timeline_days);

            return (
              <Link
                key={payment.id}
                href={
                  project?.id
                    ? `/dashboard/contractor/projects/${project.id}`
                    : '/dashboard/contractor/jobs'
                }
                className="block px-4 py-3 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-[#0f172a]">
                      {project?.title ?? 'Project'}
                    </div>

                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {project?.paid_at
                        ? `Paid ${relativeTime(project.paid_at)}`
                        : 'Paid job'}
                    </div>

                    <div className="mt-1 text-[11px] font-semibold text-slate-600">
                      {daysLeft !== null
                        ? daysLeft >= 0
                          ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
                          : `${Math.abs(daysLeft)} day${
                              Math.abs(daysLeft) === 1 ? '' : 's'
                            } overdue`
                        : 'No timeline'}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-xs font-black text-[#0f172a]">
                      {formatCurrency(Number(payment.project_amount ?? offer?.amount ?? 0))}
                    </div>

                    <SmallStatus status={project?.status ?? 'paid'} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function TopLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}

function HeaderMetric({
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

      <div className="mt-1 text-2xl font-black tracking-tight text-[#0f172a]">
        {value}
      </div>

      <div className="mt-0.5 text-xs font-semibold text-slate-500">
        {detail}
      </div>
    </div>
  );
}

function SmallStatus({ status }: { status: string }) {
  const className =
    status === 'in_progress'
      ? 'bg-blue-100 text-blue-700'
      : status === 'completed'
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-amber-100 text-amber-800';

  return (
    <span
      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${className}`}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}

function contractorFeeAmount(payment: any): number {
  const offer = firstRow<any>(payment.offers);
  const projectAmount = Number(payment.project_amount ?? offer?.amount ?? 0);
  const storedFee = Number(payment.contractor_fee_amount ?? 0);

  if (storedFee > 0) return storedFee;

  return Math.round(projectAmount * 0.05 * 100) / 100;
}

function contractorNetAmount(payment: any): number {
  const payout = Number(
    payment.contractor_payout_amount ?? payment.deposit_amount ?? 0,
  );

  if (payout > 0) return payout;

  const offer = firstRow<any>(payment.offers);
  const projectAmount = Number(payment.project_amount ?? offer?.amount ?? 0);

  return Math.max(0, projectAmount - contractorFeeAmount(payment));
}

function getDaysLeft(
  paidAt: string | null | undefined,
  timelineDays: number | null | undefined,
): number | null {
  if (!paidAt || !timelineDays) return null;

  const start = new Date(paidAt);
  const due = new Date(start);

  due.setDate(start.getDate() + Number(timelineDays));

  const today = new Date();
  const diff = due.getTime() - today.getTime();

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function categoryName(value: any): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value.name ?? null;
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function sizeLabel(budgetMax: number | null) {
  if (!budgetMax) return 'Open size';
  if (budgetMax < 10000) return 'Small project';
  if (budgetMax < 30000) return 'Medium project';
  return 'Large project';
}

function relative(date: string, prefix: string) {
  const created = new Date(date).getTime();
  const diffHours = Math.max(
    1,
    Math.round((Date.now() - created) / (1000 * 60 * 60)),
  );
  if (diffHours < 24) return `${prefix} ${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${prefix} ${diffDays}d ago`;
}

function demoLeads(): ContractorLead[] {
  return [
    {
      id: 'demo-lead-1',
      isDemo: true,
      title: 'Primary kitchen remodel',
      description:
        'Full kitchen renovation with new cabinets, countertops, appliances, and flooring.',
      zip_code: '78704',
      city: 'Austin',
      state: 'TX',
      category: 'Kitchen Remodel',
      budget_min: 25000,
      budget_max: 35000,
      start: '12 – 16 days',
      response: 'High response',
      size: 'Large project',
      photos: 8,
      image: stockImages[0],
      homeowner_id: null,
    },
    {
      id: 'demo-lead-2',
      isDemo: true,
      title: 'Primary bathroom remodel',
      description:
        'Modernize primary bathroom with walk-in shower, double vanity, and new tile.',
      zip_code: '78745',
      city: 'Austin',
      state: 'TX',
      category: 'Bathroom Remodel',
      budget_min: 12000,
      budget_max: 18000,
      start: '18 – 24 days',
      response: 'Medium response',
      size: 'Medium project',
      photos: 5,
      image: stockImages[1],
      homeowner_id: null,
    },
    {
      id: 'demo-lead-3',
      isDemo: true,
      title: 'Deck replacement',
      description: 'Replace existing wood deck with composite decking.',
      zip_code: '78681',
      city: 'Round Rock',
      state: 'TX',
      category: 'Decks & Patios',
      budget_min: 8000,
      budget_max: 12000,
      start: '10 – 14 days',
      response: 'Fast response',
      size: 'Small project',
      photos: 6,
      image: stockImages[2],
      homeowner_id: null,
    },
  ];
}