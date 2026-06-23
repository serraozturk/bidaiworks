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
import SupportFilterList from './SupportFilterList';

export const dynamic = 'force-dynamic';

export default async function AdminSupportPage() {
  const db = createAdminClient();

  const { data: reports, error: reportsError } = await db
    .from('support_reports')
    .select(
      `
      id,
      reporter_id,
      reporter_role,
      project_id,
      category,
      subject,
      message,
      status,
      priority,
      requested_outcome,
      contact_preference,
      page_url,
      admin_note,
      created_at,
      resolved_at
    `,
    )
    .order('created_at', { ascending: false });

  if (reportsError) {
    console.error('Admin support reports query error:', reportsError);
    throw new Error(reportsError.message);
  }

  const rows = reports ?? [];

  const reporterIds = [
    ...new Set(rows.map((report) => report.reporter_id).filter(Boolean)),
  ];

  const { data: profiles } = reporterIds.length
    ? await db
        .from('profiles')
        .select('id, full_name, role')
        .in('id', reporterIds)
    : { data: [] as any[] };

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  const open = rows.filter((report) => report.status !== 'resolved');
  const urgent = open.filter((report) => report.priority === 'urgent');
  const high = open.filter((report) => report.priority === 'high');
  const resolved = rows.filter((report) => report.status === 'resolved');

  const openTableRows = open.map((report) => ({
    id: report.id,
    reporter_name: profileById.get(report.reporter_id)?.full_name ?? 'User',
    reporter_role: report.reporter_role,
    project_id: report.project_id,
    category: report.category,
    subject: report.subject,
    message: report.message,
    status: report.status,
    priority: report.priority,
    requested_outcome: report.requested_outcome,
    contact_preference: report.contact_preference,
    page_url: report.page_url,
    created_at: report.created_at,
  }));

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Support"
        title="Support inbox"
        description="Cases sent by homeowners and contractors. Open a case to see the reporter's profile, related project and the full conversation, then reply or resolve."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Open"
          value={open.length}
          tone={open.length ? 'danger' : 'default'}
        />

        <StatCard
          label="Urgent"
          value={urgent.length}
          tone={urgent.length ? 'danger' : 'default'}
        />

        <StatCard
          label="High priority"
          value={high.length}
          tone={high.length ? 'danger' : 'default'}
        />

        <StatCard label="Resolved" value={resolved.length} tone="success" />
      </div>

      <SupportFilterList rows={openTableRows} />

      <div className="mt-5">
        <Panel title="Resolved support cases" description={`${resolved.length} closed`}>
          {resolved.length === 0 ? (
            <EmptyRow>Nothing resolved yet.</EmptyRow>
          ) : (
            <ul className="divide-y divide-slate-100">
              {resolved.map((report) => {
                const profile = profileById.get(report.reporter_id);

                return (
                  <li
                    key={report.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill value="resolved" />
                        <Pill value={report.category ?? 'general'} />

                        <span className="text-sm font-bold text-slate-800">
                          {report.subject || 'Support request'}
                        </span>
                      </div>

                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {profile?.full_name ?? 'User'}
                        {report.reporter_role
                          ? ` (${report.reporter_role})`
                          : ''}{' '}
                        · opened {formatWhen(report.created_at)}
                        {report.resolved_at
                          ? ` · resolved ${formatWhen(report.resolved_at)}`
                          : ''}
                      </p>

                      {report.admin_note && (
                        <p className="mt-2 max-w-2xl whitespace-pre-wrap rounded-xl bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900">
                          <span className="font-black text-emerald-700">
                            Admin response:{' '}
                          </span>
                          {report.admin_note}
                        </p>
                      )}

                      {report.project_id && (
                        <Link
                          href={`/admin/projects/${report.project_id}`}
                          className="mt-2 inline-flex text-xs font-black text-orange-600 hover:underline"
                        >
                          Open related project
                        </Link>
                      )}
                    </div>

                    <div className="shrink-0 text-xs font-semibold text-slate-400">
                      {report.resolved_at
                        ? formatWhen(report.resolved_at)
                        : formatWhen(report.created_at)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
