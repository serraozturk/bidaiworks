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
import { AdminActionButton } from '@/components/admin/AdminActionButton';

export const dynamic = 'force-dynamic';

type DisputeResolution = 'released' | 'refunded' | 'dismissed';

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

      <Panel
        title="Open disputes"
        description={`${open.length} needing a decision`}
      >
        {open.length === 0 ? (
          <EmptyRow>No open disputes.</EmptyRow>
        ) : (
          <ul className="divide-y divide-slate-100">
            {open.map((dispute) => (
              <li key={dispute.id} className="px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/projects/${dispute.project_id}`}
                    className="text-sm font-black text-slate-900 hover:text-orange-600"
                  >
                    {titleById.get(dispute.project_id) ?? 'Project'}
                  </Link>

                  <Pill value="open" />
                  <Pill value={dispute.category ?? 'work_quality'} />
                  <Pill value={dispute.priority ?? 'high'} />
                </div>

                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Raised by {dispute.raised_by_role ?? 'a participant'} ·{' '}
                  {formatWhen(dispute.created_at)}
                </p>

                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                  {dispute.reason || 'No reason provided.'}
                </p>

                {dispute.requested_resolution && (
                  <p className="mt-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-900">
                    Requested resolution:{' '}
                    {String(dispute.requested_resolution).replaceAll('_', ' ')}
                  </p>
                )}

                {dispute.evidence_summary && (
                  <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                    <span className="font-black text-slate-500">
                      Evidence:{' '}
                    </span>
                    {dispute.evidence_summary}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <ResolveButton
                    id={dispute.id}
                    resolution="released"
                    label="Release escrow to contractor"
                    tone="emerald"
                  />

                  <ResolveButton
                    id={dispute.id}
                    resolution="refunded"
                    label="Refund the homeowner"
                    tone="rose"
                  />

                  <ResolveButton
                    id={dispute.id}
                    resolution="dismissed"
                    label="Dismiss dispute"
                    tone="slate"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

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

function ResolveButton({
  id,
  resolution,
  label,
}: {
  id: string;
  resolution: DisputeResolution;
  label: string;
  tone: 'emerald' | 'rose' | 'slate';
}) {
  return (
    <form action={resolveDispute}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="resolution" value={resolution} />

      <AdminActionButton>{label}</AdminActionButton>
    </form>
  );
}