import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { formatRange, relativeTime } from '@/lib/utils';
import { countUnreadConversations } from '@/lib/unread';

export const dynamic = 'force-dynamic';

type ProjectRow = {
  id: string;
  title: string;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  status: string;
  moderation_status: string | null;
  payment_status: string | null;
  ai_estimate_min: number | null;
  ai_estimate_max: number | null;
  created_at: string;
  desired_start_date: string | null;
  paid_at: string | null;
  completed_at: string | null;
  categories: { name: string } | { name: string }[] | null;
};

export default async function AllProjectsPage() {
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

  if (profile?.role !== 'homeowner') redirect('/dashboard');

  const [{ data: projects, error }, unreadMessages] = await Promise.all([
    supabase
      .from('projects')
      .select(`
        id,
        title,
        zip_code,
        city,
        state,
        status,
        moderation_status,
        payment_status,
        ai_estimate_min,
        ai_estimate_max,
        created_at,
        desired_start_date,
        paid_at,
        completed_at,
        categories(name)
      `)
      .eq('homeowner_id', user.id)
      .order('created_at', { ascending: false }),

    countUnreadConversations(supabase, user.id, 'homeowner'),
  ]);

  if (error) {
    console.error('All projects query error:', error);
    throw new Error(error.message);
  }

  const rows = (projects ?? []) as ProjectRow[];

  // Fetch offer counts per project
  const projectIds = rows.map((p) => p.id);
  const offerCountById = new Map<string, number>();
  const activeOfferCountById = new Map<string, number>();

  if (projectIds.length > 0) {
    const { data: offers } = await supabase
      .from('offers')
      .select('project_id, status')
      .in('project_id', projectIds);

    for (const o of offers ?? []) {
      offerCountById.set(o.project_id, (offerCountById.get(o.project_id) ?? 0) + 1);
      if (['pending', 'countered', 'accepted'].includes(o.status)) {
        activeOfferCountById.set(o.project_id, (activeOfferCountById.get(o.project_id) ?? 0) + 1);
      }
    }
  }

  // Status group counts for the filter chips
  const active = rows.filter((p) => ['open', 'in_review', 'quoted', 'negotiating'].includes(p.status));
  const inProgress = rows.filter((p) => ['pending_payment', 'paid', 'in_progress'].includes(p.status));
  const completed = rows.filter((p) => p.status === 'completed');
  const archived = rows.filter((p) => ['cancelled', 'expired'].includes(p.status));

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role="homeowner"
          active="projects"
          messageCount={unreadMessages ?? 0}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1100px] px-5 py-6">

            {/* Header */}
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#f45112]">
                  My projects
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight">
                  All projects
                </h1>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {rows.length === 0
                    ? 'You have no projects yet.'
                    : `${rows.length} project${rows.length === 1 ? '' : 's'} total`}
                </p>
              </div>

              <Link
                href="/dashboard/homeowner/new"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#f45112] px-4 text-sm font-black text-white hover:bg-[#d94406]"
              >
                + New project
              </Link>
            </div>

            {rows.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* Summary chips */}
                <div className="mb-5 flex flex-wrap gap-2">
                  <Chip label="All" count={rows.length} active />
                  {active.length > 0 && <Chip label="Active" count={active.length} color="blue" />}
                  {inProgress.length > 0 && <Chip label="In progress" count={inProgress.length} color="emerald" />}
                  {completed.length > 0 && <Chip label="Completed" count={completed.length} color="slate" />}
                  {archived.length > 0 && <Chip label="Archived" count={archived.length} color="slate" />}
                </div>

                {/* Project groups */}
                {inProgress.length > 0 && (
                  <ProjectGroup
                    title="In progress"
                    projects={inProgress}
                    offerCountById={offerCountById}
                    activeOfferCountById={activeOfferCountById}
                  />
                )}

                {active.length > 0 && (
                  <ProjectGroup
                    title="Active — collecting offers"
                    projects={active}
                    offerCountById={offerCountById}
                    activeOfferCountById={activeOfferCountById}
                  />
                )}

                {completed.length > 0 && (
                  <ProjectGroup
                    title="Completed"
                    projects={completed}
                    offerCountById={offerCountById}
                    activeOfferCountById={activeOfferCountById}
                  />
                )}

                {archived.length > 0 && (
                  <ProjectGroup
                    title="Archived"
                    projects={archived}
                    offerCountById={offerCountById}
                    activeOfferCountById={activeOfferCountById}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Project group                                                               */
/* -------------------------------------------------------------------------- */

function ProjectGroup({
  title,
  projects,
  offerCountById,
  activeOfferCountById,
}: {
  title: string;
  projects: ProjectRow[];
  offerCountById: Map<string, number>;
  activeOfferCountById: Map<string, number>;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-1 text-xs font-black uppercase tracking-widest text-slate-400">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {projects.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              offerCount={offerCountById.get(p.id) ?? 0}
              activeOfferCount={activeOfferCountById.get(p.id) ?? 0}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Single project row                                                          */
/* -------------------------------------------------------------------------- */

function ProjectRow({
  project,
  offerCount,
  activeOfferCount,
}: {
  project: ProjectRow;
  offerCount: number;
  activeOfferCount: number;
}) {
  const status = projectStatusConfig(project.status, project.moderation_status);
  const category = categoryName(project.categories) ?? 'Renovation';
  const estimate = formatRange(project.ai_estimate_min, project.ai_estimate_max);

  const canCompare =
    ['open', 'in_review', 'quoted', 'negotiating'].includes(project.status) &&
    offerCount > 0;
  const needsCheckout = project.status === 'pending_payment';
  const isCompleted = project.status === 'completed';

  return (
    <li className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto]">
      {/* Left: title + meta */}
      <Link href={`/dashboard/homeowner/projects/${project.id}`} className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-black text-[#0f172a] hover:text-[#f45112]">
            {project.title}
          </h3>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${status.className}`}>
            {status.label}
          </span>
        </div>

        <p className="mt-1 text-xs font-semibold text-slate-500">
          {category}
          {project.city ? ` · ${project.city}` : ''}
          {project.state ? `, ${project.state}` : ''}
          {project.zip_code ? ` ${project.zip_code}` : ''}
        </p>

        <div className="mt-2 flex flex-wrap gap-3">
          <MetaBit label="AI estimate" value={estimate} />
          <MetaBit
            label="Offers"
            value={offerCount === 0 ? 'None yet' : `${activeOfferCount} active / ${offerCount} total`}
            highlight={activeOfferCount > 0}
          />
          <MetaBit
            label="Created"
            value={relativeTime(project.created_at)}
          />
          {project.completed_at && (
            <MetaBit label="Completed" value={relativeTime(project.completed_at)} />
          )}
        </div>
      </Link>

      {/* Right: action buttons */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:justify-center">
        <Link
          href={`/dashboard/homeowner/projects/${project.id}`}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50"
        >
          {isCompleted ? 'Summary' : 'View'}
        </Link>

        {needsCheckout && (
          <Link
            href={`/dashboard/checkout/project/${project.id}`}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f4510b] px-4 text-xs font-black text-white transition hover:bg-[#d94406]"
          >
            Checkout →
          </Link>
        )}

        {canCompare && (
          <Link
            href={`/dashboard/homeowner/compare?project=${project.id}`}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f45112] px-4 text-xs font-black text-white transition hover:bg-[#d94406]"
          >
            Compare offers
          </Link>
        )}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                               */
/* -------------------------------------------------------------------------- */

function MetaBit({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <span className="text-[11px] font-semibold">
      <span className="text-slate-400">{label}: </span>
      <span className={highlight ? 'font-black text-[#f45112]' : 'text-slate-600'}>{value}</span>
    </span>
  );
}

function Chip({
  label,
  count,
  active = false,
  color = 'orange',
}: {
  label: string;
  count: number;
  active?: boolean;
  color?: 'orange' | 'blue' | 'emerald' | 'slate';
}) {
  const colorMap = {
    orange: 'bg-orange-100 text-orange-800',
    blue: 'bg-blue-100 text-blue-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    slate: 'bg-slate-200 text-slate-700',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
        active ? 'bg-[#f45112] text-white' : colorMap[color]
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20' : 'bg-black/10'}`}>
        {count}
      </span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-orange-50 text-2xl">
        🏠
      </div>
      <h2 className="mt-4 text-xl font-black text-slate-900">No projects yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Create your first project to get AI-powered estimates and contractor offers.
      </p>
      <Link
        href="/dashboard/homeowner/new"
        className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-[#f4510b] px-5 text-sm font-black text-white transition hover:bg-[#d94406]"
      >
        Create project
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Status config (mirrors homeowner/page.tsx)                                 */
/* -------------------------------------------------------------------------- */

function projectStatusConfig(status: string, moderationStatus?: string | null) {
  if (status === 'open' && (moderationStatus ?? 'pending') === 'pending') {
    return { label: 'Under review', className: 'bg-amber-100 text-amber-800' };
  }
  if (status === 'open' && moderationStatus === 'rejected') {
    return { label: 'Not approved', className: 'bg-slate-200 text-slate-600' };
  }
  if (status === 'open') {
    return { label: 'Open', className: 'bg-blue-100 text-blue-700' };
  }
  if (['in_review', 'quoted', 'negotiating'].includes(status)) {
    return { label: 'Negotiating', className: 'bg-amber-100 text-amber-800' };
  }
  if (status === 'pending_payment') {
    return { label: 'Payment required', className: 'bg-orange-100 text-orange-700' };
  }
  if (status === 'paid') {
    return { label: 'Awaiting contractor', className: 'bg-violet-100 text-violet-700' };
  }
  if (status === 'in_progress') {
    return { label: 'In progress', className: 'bg-emerald-100 text-emerald-700' };
  }
  if (status === 'completed') {
    return { label: 'Completed', className: 'bg-slate-200 text-slate-700' };
  }
  if (status === 'cancelled') {
    return { label: 'Cancelled', className: 'bg-slate-200 text-slate-600' };
  }
  if (status === 'expired') {
    return { label: 'Expired', className: 'bg-slate-200 text-slate-600' };
  }
  return { label: status.replaceAll('_', ' '), className: 'bg-slate-100 text-slate-700' };
}

function categoryName(value: any): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value.name ?? null;
}
