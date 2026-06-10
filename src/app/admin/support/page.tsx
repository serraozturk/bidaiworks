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
        .select('id, full_name, email, role')
        .in('id', reporterIds)
    : { data: [] as any[] };

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  const open = rows.filter((report) => report.status !== 'resolved');
  const urgent = open.filter((report) => report.priority === 'urgent');
  const high = open.filter((report) => report.priority === 'high');
  const resolved = rows.filter((report) => report.status === 'resolved');

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

      <Panel title="Open support cases" description={`${open.length} awaiting response`}>
        {open.length === 0 ? (
          <EmptyRow>No open support cases.</EmptyRow>
        ) : (
          <ul className="divide-y divide-slate-100">
            {open.map((report) => {
              const profile = profileById.get(report.reporter_id);

              return (
                <li key={report.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill value={report.status ?? 'awaiting_admin'} />
                    <Pill value={report.category ?? 'general'} />
                    <PriorityPill value={report.priority ?? 'normal'} />

                    <Link
                      href={`/admin/support/${report.id}`}
                      className="text-sm font-black text-slate-900 hover:text-orange-600 hover:underline"
                    >
                      {report.subject || 'Support request'}
                    </Link>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-400">
                    <span>
                      {profile?.full_name ?? 'User'}
                      {report.reporter_role ? ` (${report.reporter_role})` : ''}
                    </span>

                    <span>·</span>

                    <span>Opened {formatWhen(report.created_at)}</span>

                    <span>·</span>

                    <span>Case #{String(report.id).slice(0, 8)}</span>

                    {report.project_id ? (
                      <>
                        <span>·</span>
                        <Link
                          href={`/admin/projects/${report.project_id}`}
                          className="font-black text-orange-600 hover:underline"
                        >
                          Open related project
                        </Link>
                      </>
                    ) : null}
                  </div>

                  <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                    {report.message || 'No message provided.'}
                  </p>

                  <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                    {report.requested_outcome && (
                      <InfoBox
                        label="Requested outcome"
                        value={report.requested_outcome}
                      />
                    )}

                    {report.contact_preference && (
                      <InfoBox
                        label="Contact preference"
                        value={readableStatus(report.contact_preference)}
                      />
                    )}

                    {report.page_url && (
                      <InfoBox
                        label="Page"
                        value={report.page_url}
                        wide
                      />
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">
                      Open the case to see reporter history, related project
                      and the full thread.
                    </p>

                    <Link
                      href={`/admin/support/${report.id}`}
                      className="inline-flex h-9 items-center rounded-xl bg-[#f45112] px-4 text-xs font-black text-white transition hover:bg-[#d94406]"
                    >
                      Open case →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

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

function StatusPill({ value }: { value: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    awaiting_admin: {
      label: 'Awaiting bidAI',
      cls: 'bg-amber-100 text-amber-800',
    },
    awaiting_reporter: {
      label: 'Awaiting reporter',
      cls: 'bg-sky-100 text-sky-800',
    },
    open: { label: 'Awaiting bidAI', cls: 'bg-amber-100 text-amber-800' },
    resolved: { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-800' },
  };
  const found =
    map[value] ?? { label: value, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${found.cls}`}
    >
      {found.label}
    </span>
  );
}

function PriorityPill({ value }: { value: string }) {
  const color =
    value === 'urgent'
      ? 'bg-red-50 text-red-700 ring-red-100'
      : value === 'high'
        ? 'bg-orange-50 text-orange-700 ring-orange-100'
        : value === 'low'
          ? 'bg-slate-50 text-slate-600 ring-slate-100'
          : 'bg-amber-50 text-amber-700 ring-amber-100';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase ring-1 ${color}`}
    >
      {readableStatus(value)}
    </span>
  );
}

function InfoBox({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white px-3 py-2 ${
        wide ? 'md:col-span-2' : ''
      }`}
    >
      <span className="font-black text-slate-500">{label}: </span>
      <span className="break-all text-slate-700">{value}</span>
    </div>
  );
}

function readableStatus(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase());
}