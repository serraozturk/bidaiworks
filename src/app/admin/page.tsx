import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AdminPageHeader,
  StatCard,
  Panel,
  Pill,
  EmptyRow,
  money,
  formatWhen,
} from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

/**
 * Admin overview — kept deliberately minimal. Two things only:
 *   1. A pulse: what's the marketplace doing right now.
 *   2. An inbox: what needs your attention, with a single link per item.
 *
 * Every drill-down lives on a dedicated page (projects, contractors,
 * payments, flags, disputes, support). The overview's job is to surface
 * what's open and get out of the way.
 */
export default async function AdminOverviewPage() {
  const db = createAdminClient();

  await db.rpc('expire_stale_deals').then(() => undefined, () => undefined);

  const [
    { count: projectCount },
    { count: contractorCount },
    { count: messageCount },
    { data: projects },
    { data: payments },
    { count: openFlagCount },
    { count: openDisputeCount },
    { count: openSupportCount },
    { data: events },
  ] = await Promise.all([
    db.from('projects').select('id', { count: 'exact', head: true }),
    db.from('contractor_profiles').select('user_id', { count: 'exact', head: true }),
    db.from('messages').select('id', { count: 'exact', head: true }),
    db
      .from('projects')
      .select('id, status, contractor_fee_status, moderation_status'),
    db.from('payments').select('status, total_amount, project_amount'),
    db.from('admin_flags').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    db.from('disputes').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
    db
      .from('support_reports')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'resolved'),
    db
      .from('marketplace_events')
      .select('id, event_type, summary, created_at, project_id')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const allProjects = projects ?? [];
  const allPayments = payments ?? [];

  const pendingReview = allProjects.filter(
    (p) => (p.moderation_status ?? 'pending') === 'pending',
  ).length;
  const awaitingCommitment = allProjects.filter(
    (p) => p.status === 'paid' && p.contractor_fee_status === 'due',
  ).length;
  const activeJobs = allProjects.filter((p) => p.status === 'in_progress').length;
  const inEscrow = allPayments
    .filter((p) => p.status === 'held')
    .reduce((s, p) => s + Number(p.total_amount ?? 0), 0);
  const gmv = allPayments
    .filter((p) => ['held', 'released'].includes(String(p.status)))
    .reduce((s, p) => s + Number(p.project_amount ?? 0), 0);

  const inbox = [
    {
      label: 'Projects waiting for review',
      count: pendingReview,
      href: '/admin/projects',
      tone: 'warning' as const,
    },
    {
      label: 'Open moderation flags',
      count: openFlagCount ?? 0,
      href: '/admin/flags',
      tone: 'danger' as const,
    },
    {
      label: 'Open disputes',
      count: openDisputeCount ?? 0,
      href: '/admin/disputes',
      tone: 'danger' as const,
    },
    {
      label: 'Open support cases',
      count: openSupportCount ?? 0,
      href: '/admin/support',
      tone: 'warning' as const,
    },
    {
      label: 'Contractor commitments overdue',
      count: awaitingCommitment,
      href: '/admin/payments',
      tone: 'warning' as const,
    },
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Overview"
        title="Admin overview"
        description="What needs your attention, and how the marketplace is doing."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Projects" value={projectCount ?? 0} />
        <StatCard label="Contractors" value={contractorCount ?? 0} />
        <StatCard label="In escrow" value={money(inEscrow)} tone="brand" />
        <StatCard label="GMV (paid)" value={money(gmv)} tone="success" />
      </div>

      <div className="mb-6">
        <Panel
          title="Needs your attention"
          description={`${inbox.reduce(
            (s, i) => s + (Number(i.count) || 0),
            0,
          )} item(s) open across the marketplace.`}
        >
          <ul className="divide-y divide-slate-100">
            {inbox.map((item) => {
              const count = Number(item.count) || 0;
              const isQuiet = count === 0;
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className={`flex items-center justify-between gap-3 px-4 py-3 transition ${
                      isQuiet
                        ? 'text-slate-500 hover:bg-slate-50'
                        : 'font-bold text-slate-900 hover:bg-orange-50'
                    }`}
                  >
                    <span>{item.label}</span>
                    <CountBadge value={count} tone={isQuiet ? 'quiet' : item.tone} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Panel
          title="Recent activity"
          description="Newest first — full history in the audit log."
          right={
            <Link
              href="/admin/events"
              className="text-xs font-black text-orange-600 hover:underline"
            >
              All events →
            </Link>
          }
        >
          {(events ?? []).length === 0 ? (
            <EmptyRow>No activity recorded yet.</EmptyRow>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(events ?? []).map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5">
                    <Pill
                      value={e.event_type.replace(
                        /^(project|offer|payment|admin)_/,
                        '',
                      )}
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700">
                      {e.summary ?? e.event_type}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      {formatWhen(e.created_at)}
                      {e.project_id ? (
                        <>
                          {' · '}
                          <Link
                            href={`/admin/projects/${e.project_id}`}
                            className="text-orange-600 hover:underline"
                          >
                            project
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel title="Pulse">
            <ul className="divide-y divide-slate-100">
              <PulseRow label="Active jobs" value={String(activeJobs)} />
              <PulseRow label="Messages" value={String(messageCount ?? 0)} />
            </ul>
          </Panel>

          <Panel title="Jump to">
            <ul className="divide-y divide-slate-100">
              <JumpRow href="/admin/projects" label="Projects" />
              <JumpRow href="/admin/contractors" label="Contractors" />
              <JumpRow href="/admin/conversations" label="Conversations" />
              <JumpRow href="/admin/payments" label="Payments & escrow" />
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CountBadge({
  value,
  tone,
}: {
  value: number;
  tone: 'warning' | 'danger' | 'quiet';
}) {
  const cls =
    tone === 'danger'
      ? value > 0
        ? 'bg-red-600 text-white'
        : 'bg-slate-100 text-slate-400'
      : tone === 'warning'
        ? value > 0
          ? 'bg-amber-500 text-white'
          : 'bg-slate-100 text-slate-400'
        : 'bg-slate-100 text-slate-400';
  return (
    <span
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2.5 text-xs font-black ${cls}`}
    >
      {value}
    </span>
  );
}

function PulseRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-sm font-black text-slate-900">{value}</span>
    </li>
  );
}

function JumpRow({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-orange-50 hover:text-orange-700"
      >
        <span>{label}</span>
        <span className="text-xs font-black text-orange-600">→</span>
      </Link>
    </li>
  );
}
