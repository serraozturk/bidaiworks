import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AdminPageHeader,
  Panel,
  Pill,
  BackLink,
  formatWhen,
} from '@/components/admin/ui';
import AdminSupportActions from './admin-actions';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

export default async function AdminSupportDetailPage({ params }: Params) {
  const db = createAdminClient();

  const { data: report } = await db
    .from('support_reports')
    .select(
      `
      id, reporter_id, reporter_role, project_id, category, priority,
      subject, message, status, admin_note, requested_outcome,
      contact_preference, page_url, created_at, resolved_at,
      last_user_message_at
    `,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!report) notFound();

  // Pull the reporter profile, reporter's email, their other support
  // history, the related project (if any), and the conversation thread —
  // all in parallel so the page renders fast.
  const [
    { data: reporterProfile },
    { data: otherReports },
    { data: project },
    { data: thread },
  ] = await Promise.all([
    db
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', report.reporter_id)
      .maybeSingle(),
    db
      .from('support_reports')
      .select('id, subject, status, category, priority, created_at')
      .eq('reporter_id', report.reporter_id)
      .neq('id', report.id)
      .order('created_at', { ascending: false })
      .limit(8),
    report.project_id
      ? db
          .from('projects')
          .select(
            'id, title, status, payment_status, contractor_fee_status, moderation_status, homeowner_id, category_id, created_at',
          )
          .eq('id', report.project_id)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
    db
      .from('support_messages')
      .select('id, sender_id, sender_role, body, created_at')
      .eq('report_id', report.id)
      .order('created_at', { ascending: true }),
  ]);

  let reporterEmail: string | null = null;
  try {
    const { data } = await db.auth.admin.getUserById(report.reporter_id);
    reporterEmail = data.user?.email ?? null;
  } catch {
    /* not fatal */
  }

  const messages = thread ?? [];
  const senderIds = [
    ...new Set(messages.map((m) => m.sender_id).filter(Boolean)),
  ];
  const { data: senders } = senderIds.length
    ? await db.from('profiles').select('id, full_name, role').in('id', senderIds)
    : { data: [] as any[] };
  const senderById = new Map((senders ?? []).map((s) => [s.id, s]));

  const isResolved = report.status === 'resolved';
  const reporterName =
    reporterProfile?.full_name || reporterEmail || 'Reporter';

  return (
    <div className="mx-auto max-w-[1240px] px-6 py-6">
      <div className="mb-4">
        <BackLink href="/admin/support" label="All support cases" />
      </div>

      <AdminPageHeader
        eyebrow={`Case #${String(report.id).slice(0, 8)}`}
        title={report.subject || 'Support case'}
        description={`Opened by ${reporterName}${
          report.reporter_role ? ` (${report.reporter_role})` : ''
        } on ${formatWhen(report.created_at)}.`}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusPill value={report.status ?? 'awaiting_admin'} />
        <PriorityPill value={report.priority ?? 'normal'} />
        <Pill value={report.category ?? 'general'} />
        {report.contact_preference && (
          <Pill value={`prefers ${report.contact_preference}`} />
        )}
        {report.requested_outcome && (
          <span className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-[11px] font-black text-orange-800">
            Wants: {report.requested_outcome}
          </span>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Panel
            title="Conversation"
            description={`${messages.length + 1} message${messages.length === 0 ? '' : 's'} — original report plus replies.`}
          >
            <div className="divide-y divide-slate-100">
              <ThreadBubble
                tone="reporter"
                name={reporterName}
                role={report.reporter_role ?? 'reporter'}
                when={formatWhen(report.created_at)}
                body={report.message || ''}
                label="Initial report"
              />

              {messages.map((m) => {
                const senderProfile = senderById.get(m.sender_id);
                const senderName =
                  m.sender_role === 'admin'
                    ? senderProfile?.full_name || 'bidAI support'
                    : senderProfile?.full_name || reporterName;
                return (
                  <ThreadBubble
                    key={m.id}
                    tone={m.sender_role === 'admin' ? 'admin' : 'reporter'}
                    name={senderName}
                    role={m.sender_role}
                    when={formatWhen(m.created_at)}
                    body={m.body}
                  />
                );
              })}

              {isResolved && (
                <div className="bg-emerald-50/50 px-4 py-4">
                  <div className="text-xs font-black uppercase tracking-wide text-emerald-700">
                    Case resolved
                  </div>
                  <div className="mt-0.5 text-xs text-emerald-800">
                    Closed {formatWhen(report.resolved_at)}.
                  </div>
                  {report.admin_note && (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                      <span className="font-black text-emerald-700">
                        Resolution note:{' '}
                      </span>
                      {report.admin_note}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Panel>

          {!isResolved && <AdminSupportActions reportId={report.id} />}
        </div>

        <aside className="space-y-5">
          <Panel title="Reporter">
            <div className="space-y-2 px-4 py-3 text-sm">
              <Row label="Name" value={reporterName} />
              <Row label="Role" value={reporterProfile?.role ?? 'unknown'} />
              <Row label="Email" value={reporterEmail ?? '—'} mono />
              <Row label="User ID" value={String(report.reporter_id).slice(0, 12)} mono />

              {reporterProfile?.role === 'contractor' && (
                <Link
                  href={`/admin/contractors/${report.reporter_id}`}
                  className="mt-2 inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  Open contractor profile →
                </Link>
              )}
              {reporterProfile?.role === 'homeowner' && (
                <Link
                  href={`/admin/users/${report.reporter_id}`}
                  className="mt-2 inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  Open homeowner profile →
                </Link>
              )}
            </div>
          </Panel>

          {project ? (
            <Panel title="Related project">
              <div className="space-y-2 px-4 py-3 text-sm">
                <Link
                  href={`/admin/projects/${project.id}`}
                  className="block font-black text-slate-900 hover:text-orange-600 hover:underline"
                >
                  {project.title}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill value={project.status ?? 'draft'} />
                  <Pill value={project.payment_status ?? 'unpaid'} />
                  {project.moderation_status && (
                    <Pill value={`mod: ${project.moderation_status}`} />
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Created {formatWhen(project.created_at)}
                </p>
                <Link
                  href={`/admin/projects/${project.id}`}
                  className="mt-2 inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  Open project details →
                </Link>
              </div>
            </Panel>
          ) : (
            <Panel title="Related project">
              <div className="px-4 py-3 text-sm text-slate-500">
                The reporter did not attach a specific project.
              </div>
            </Panel>
          )}

          <Panel
            title="Reporter history"
            description={`${(otherReports ?? []).length} other report${
              (otherReports ?? []).length === 1 ? '' : 's'
            }`}
          >
            {(otherReports ?? []).length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">
                This is their only support case.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(otherReports ?? []).map((r: any) => (
                  <li key={r.id} className="px-4 py-3">
                    <Link
                      href={`/admin/support/${r.id}`}
                      className="text-sm font-black text-slate-900 hover:text-orange-600 hover:underline"
                    >
                      {r.subject || 'Support case'}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusPill value={r.status ?? 'awaiting_admin'} />
                      <Pill value={r.category ?? 'general'} />
                      <span className="text-[11px] text-slate-400">
                        {formatWhen(r.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {report.page_url && (
            <Panel title="Submitted from">
              <p className="break-all px-4 py-3 text-xs text-slate-600">
                {report.page_url}
              </p>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-16 shrink-0 text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-sm text-slate-700 ${
          mono ? 'font-mono text-xs' : 'font-semibold'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ThreadBubble({
  tone,
  name,
  role,
  when,
  body,
  label,
}: {
  tone: 'reporter' | 'admin';
  name: string;
  role: string;
  when: string;
  body: string;
  label?: string;
}) {
  const isAdmin = tone === 'admin';
  return (
    <div className={isAdmin ? 'bg-orange-50/40 px-4 py-4' : 'bg-white px-4 py-4'}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={[
            'inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-black uppercase tracking-wide',
            isAdmin
              ? 'bg-orange-600 text-white'
              : 'bg-slate-900 text-white',
          ].join(' ')}
        >
          {isAdmin ? 'bidAI support' : role}
        </span>
        <span className="text-sm font-bold text-slate-700">{name}</span>
        <span className="text-[11px] font-semibold text-slate-400">{when}</span>
        {label && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-800">
            {label}
          </span>
        )}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
        {body}
      </p>
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
  const found = map[value] ?? { label: value, cls: 'bg-slate-100 text-slate-600' };
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
      ? 'bg-red-100 text-red-800'
      : value === 'high'
        ? 'bg-orange-100 text-orange-800'
        : value === 'low'
          ? 'bg-slate-100 text-slate-600'
          : 'bg-amber-100 text-amber-800';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${color}`}
    >
      {value} priority
    </span>
  );
}
