import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AdminPageHeader,
  Panel,
  Pill,
  EmptyRow,
  StatCard,
  formatWhen,
} from '@/components/admin/ui';
import { approveProject, rejectProject } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

export default async function AdminProjectsPage() {
  const db = createAdminClient();

  await db.rpc('expire_stale_deals').then(
    () => undefined,
    () => undefined,
  );

  const [
    { data: projects, error: projectsError },
    { data: profiles },
    { data: categories },
    { data: offers },
  ] = await Promise.all([
    db
      .from('projects')
      .select(
        `
        id,
        title,
        status,
        payment_status,
        contractor_fee_status,
        moderation_status,
        moderation_note,
        homeowner_id,
        category_id,
        created_at
      `,
      )
      .order('created_at', { ascending: false }),

    db.from('profiles').select('id, full_name'),

    db.from('categories').select('id, name'),

    db.from('offers').select('project_id'),
  ]);

  if (projectsError) {
    console.error('Admin projects query error:', projectsError);
    throw new Error(projectsError.message);
  }

  const rows = projects ?? [];

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  const categoryById = new Map(
    (categories ?? []).map((category) => [category.id, category]),
  );

  const offerCount = new Map<string, number>();

  for (const offer of offers ?? []) {
    offerCount.set(
      offer.project_id,
      (offerCount.get(offer.project_id) ?? 0) + 1,
    );
  }

  const pending = rows.filter(
    (project) => (project.moderation_status ?? 'pending') === 'pending',
  );

  const rejectedCount = rows.filter(
    (project) => project.moderation_status === 'rejected',
  ).length;

  const activeCount = rows.filter((project) =>
    ['open', 'in_review', 'quoted', 'negotiating'].includes(
      String(project.status),
    ),
  ).length;

  const liveCount = rows.filter(
    (project) => project.status === 'in_progress',
  ).length;

  const completedCount = rows.filter(
    (project) => project.status === 'completed',
  ).length;

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Oversight"
        title="All projects"
        description="Approve new requests before contractors can see them, then track each project through the negotiation, payment and job lifecycle."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total projects" value={rows.length} />

        <StatCard
          label="Awaiting review"
          value={pending.length}
          tone="warning"
        />

        <StatCard label="Visible / active" value={activeCount} tone="brand" />

        <StatCard label="Active jobs" value={liveCount} tone="success" />

        <StatCard label="Completed" value={completedCount} tone="success" />
      </div>

      <div className="mb-5">
        <Panel
          title="Pending review"
          description={
            pending.length === 0
              ? 'No projects waiting — all clear.'
              : `${pending.length} project${
                  pending.length === 1 ? '' : 's'
                } hidden from contractors until you approve.`
          }
        >
          {pending.length === 0 ? (
            <EmptyRow>Nothing waiting for review.</EmptyRow>
          ) : (
            <div className="divide-y divide-slate-100">
              {pending.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/projects/${project.id}`}
                        className="truncate font-bold text-slate-900 hover:text-orange-600 hover:underline"
                      >
                        {project.title}
                      </Link>

                      <Pill value="pending review" />

                      <Pill value={project.status ?? 'draft'} />
                    </div>

                    <div className="mt-0.5 text-xs text-slate-500">
                      {profileById.get(project.homeowner_id)?.full_name ?? '—'}{' '}
                      ·{' '}
                      {categoryById.get(project.category_id)?.name ??
                        'Uncategorized'}{' '}
                      · submitted {formatWhen(project.created_at)}
                    </div>

                    {project.moderation_note && (
                      <p className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                        {project.moderation_note}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <form action={approveProject}>
                      <input type="hidden" name="id" value={project.id} />

                      <button
                        type="submit"
                        className="h-9 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white transition hover:bg-emerald-700"
                      >
                        Approve & publish
                      </button>
                    </form>

                    <form
                      action={rejectProject}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="id" value={project.id} />

                      <input
                        name="note"
                        placeholder="Reason"
                        className="h-9 w-[190px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                      />

                      <button
                        type="submit"
                        className="h-9 rounded-xl bg-rose-600 px-4 text-xs font-black text-white transition hover:bg-rose-700"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Project registry" description={`${rows.length} total`}>
        {rows.length === 0 ? (
          <EmptyRow>No projects found.</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5">Project</th>
                  <th className="px-4 py-2.5">Homeowner</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Project status</th>
                  <th className="px-4 py-2.5">Moderation</th>
                  <th className="px-4 py-2.5">Payment</th>
                  <th className="px-4 py-2.5">Contractor fee</th>
                  <th className="px-4 py-2.5">Offers</th>
                  <th className="px-4 py-2.5">Created</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rows.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/projects/${project.id}`}
                        className="font-bold text-slate-900 hover:text-orange-600 hover:underline"
                      >
                        {project.title}
                      </Link>

                      {project.moderation_note && (
                        <p className="mt-1 max-w-xs truncate text-[11px] font-semibold text-slate-400">
                          {project.moderation_note}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {profileById.get(project.homeowner_id)?.full_name ?? '—'}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {categoryById.get(project.category_id)?.name ??
                        'Uncategorized'}
                    </td>

                    <td className="px-4 py-3">
                      <Pill value={project.status ?? 'unknown'} />
                    </td>

                    <td className="px-4 py-3">
                      <Pill value={project.moderation_status ?? 'pending'} />
                    </td>

                    <td className="px-4 py-3">
                      <Pill value={project.payment_status ?? 'unpaid'} />
                    </td>

                    <td className="px-4 py-3">
                      <Pill
                        value={project.contractor_fee_status ?? 'not_due'}
                      />
                    </td>

                    <td className="px-4 py-3 font-black text-slate-900">
                      {offerCount.get(project.id) ?? 0}
                    </td>

                    <td className="px-4 py-3 text-slate-500">
                      {formatWhen(project.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {rejectedCount > 0 && (
        <div className="mt-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {rejectedCount} project{rejectedCount === 1 ? '' : 's'} rejected by
          admin moderation.
        </div>
      )}
    </div>
  );
}