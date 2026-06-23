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
import { resolveDispute } from '@/app/admin/actions';
import DisputesFilterList from './DisputesFilterList';

export const dynamic = 'force-dynamic';

export default async function AdminDisputesPage() {
  const db = createAdminClient();

  const { data: disputes, error: disputesError } = await db
    .from('disputes')
    .select(
      `
      id,
      project_id,
      raised_by,
      raised_by_role,
      category,
      priority,
      requested_resolution,
      evidence_summary,
      reason,
      status,
      resolution,
      admin_note,
      created_at,
      resolved_at
    `,
    )
    .order('created_at', { ascending: false });

  if (disputesError) {
    console.error('Admin disputes query error:', disputesError);
    throw new Error(disputesError.message);
  }

  const rows = disputes ?? [];

  const projectIds = [
    ...new Set(rows.map((dispute) => dispute.project_id).filter(Boolean)),
  ];

  const { data: projects } = projectIds.length
    ? await db.from('projects').select('id, title').in('id', projectIds)
    : { data: [] as { id: string; title: string }[] };

  const titleById = new Map(
    (projects ?? []).map((project) => [project.id, project.title]),
  );

  const open = rows.filter((dispute) => dispute.status !== 'resolved');
  const resolved = rows.filter((dispute) => dispute.status === 'resolved');

  const openTableRows = open.map((d) => ({
    id: d.id,
    project_id: d.project_id,
    project_title: titleById.get(d.project_id) ?? 'Project',
    raised_by_role: d.raised_by_role,
    category: d.category,
    priority: d.priority,
    requested_resolution: d.requested_resolution,
    evidence_summary: d.evidence_summary,
    reason: d.reason,
    created_at: d.created_at,
  }));

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Resolution"
        title="Disputes"
        description="Raised by a homeowner or contractor on a paid job. Resolving releases or refunds the escrowed funds."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          label="Open"
          value={open.length}
          tone={open.length ? 'danger' : 'default'}
        />

        <StatCard label="Resolved" value={resolved.length} tone="success" />

        <StatCard label="Total" value={rows.length} />
      </div>

      <DisputesFilterList rows={openTableRows} resolveAction={resolveDispute} />

      <div className="mt-5">
        <Panel title="Resolved" description={`${resolved.length} closed`}>
          {resolved.length === 0 ? (
            <EmptyRow>Nothing resolved yet.</EmptyRow>
          ) : (
            <ul className="divide-y divide-slate-100">
              {resolved.map((dispute) => (
                <li
                  key={dispute.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/projects/${dispute.project_id}`}
                      className="text-sm font-bold text-slate-700 hover:text-orange-600"
                    >
                      {titleById.get(dispute.project_id) ?? 'Project'}
                    </Link>

                    <p className="mt-0.5 text-xs font-semibold text-slate-400">
                      Resolved{' '}
                      {dispute.resolved_at
                        ? formatWhen(dispute.resolved_at)
                        : formatWhen(dispute.created_at)}
                    </p>

                    {dispute.admin_note && (
                      <p className="mt-2 max-w-2xl whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                        {dispute.admin_note}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Pill value={dispute.resolution ?? 'resolved'} />
                    <Pill value={dispute.status ?? 'resolved'} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
