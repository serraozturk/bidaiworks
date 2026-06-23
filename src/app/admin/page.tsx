import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AdminPageHeader,
  StatCard,
  Panel,
  EmptyRow,
  money,
  formatWhen,
} from '@/components/admin/ui';
import {
  getPendingProjectsCount,
  getPendingContractorsCount,
  getIncompleteContractorSignupsCount,
} from '@/lib/adminStats';
import OverviewActivityFilter from './OverviewActivityFilter';

export const dynamic = 'force-dynamic';

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
    { data: pendingContractors },
    pendingReview,
    pendingVerificationCount,
    incompleteSignupsCount,
  ] = await Promise.all([
    db.from('projects').select('id', { count: 'exact', head: true }),
    db.from('contractor_profiles').select('user_id', { count: 'exact', head: true }),
    db.from('messages').select('id', { count: 'exact', head: true }),
    db.from('projects').select('id, status, contractor_fee_status'),
    db.from('payments').select('status, total_amount, project_amount'),
    db.from('admin_flags').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    db.from('disputes').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
    db.from('support_reports').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
    db.from('marketplace_events')
      .select('id, event_type, summary, actor_id, project_id, created_at')
      .order('created_at', { ascending: false })
      .limit(60),
    db.from('contractor_profiles')
      .select('user_id, company_name, created_at')
      .eq('verification_status', 'pending_verification')
      .order('created_at', { ascending: false })
      .limit(5),
    // Shared helpers - same logic used by /admin/projects and /admin/contractors,
    // so the numbers here can never drift from the detail pages.
    getPendingProjectsCount(db),
    getPendingContractorsCount(db),
    getIncompleteContractorSignupsCount(db),
  ]);

  const allProjects = projects ?? [];
  const allPayments = payments ?? [];

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

  // Resolve actor names (homeowner or contractor) for the activity feed and
  // its filter dropdown.
  const eventRows = events ?? [];
  const actorIds = [...new Set(eventRows.map((e) => e.actor_id).filter(Boolean))] as string[];
  const [{ data: actorProfiles }, { data: actorCompanies }] = await Promise.all([
    actorIds.length
      ? db.from('profiles').select('id, full_name').in('id', actorIds)
      : Promise.resolve({ data: [] as any[] }),
    actorIds.length
      ? db.from('contractor_profiles').select('user_id, company_name').in('user_id', actorIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const nameById = new Map((actorProfiles ?? []).map((p) => [p.id, p.full_name]));
  const companyById = new Map((actorCompanies ?? []).map((c) => [c.user_id, c.company_name]));

  const activityRows = eventRows.map((e) => ({
    id: e.id,
    event_type: e.event_type,
    summary: e.summary ?? e.event_type,
    actor_id: e.actor_id ?? null,
    actor_name: e.actor_id
      ? companyById.get(e.actor_id) ?? nameById.get(e.actor_id) ?? null
      : null,
    project_id: e.project_id ?? null,
    created_at: e.created_at,
  }));

  const actorOptions = Array.from(
    new Map(
      activityRows
        .filter((r) => r.actor_id && r.actor_name)
        .map((r) => [r.actor_id as string, r.actor_name as string]),
    ),
  ).map(([id, name]) => ({ value: id, label: name }));

  const inbox = [
    {
      label: 'Contractor verifications pending',
      count: pendingVerificationCount,
      href: '/admin/contractors',
      tone: 'warning' as const,
    },
    {
      label: 'Incomplete contractor signups',
      count: incompleteSignupsCount,
      href: '/admin/contractors',
      tone: 'warning' as const,
    },
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
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Overview"
        title="Admin dashboard"
        description="What needs your attention, and how the marketplace is doing."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Projects" value={projectCount ?? 0} />
        <StatCard
          label="Contractors"
          value={contractorCount ?? 0}
          hint={incompleteSignupsCount > 0 ? `+${incompleteSignupsCount} incomplete signup${incompleteSignupsCount === 1 ? '' : 's'}` : undefined}
        />
        <StatCard label="In escrow" value={money(inEscrow)} tone="brand" />
        <StatCard label="GMV (paid)" value={money(gmv)} tone="success" />
      </div>

      {pendingVerificationCount > 0 && (
        <div className="mb-6 overflow-hidden rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
          <div className="flex items-center justify-between border-b border-amber-100 px-4 py-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-wide text-amber-700">
                Verification queue
              </div>
              <h2 className="mt-0.5 text-sm font-black text-amber-900">
                {pendingVerificationCount} contractor application
                {pendingVerificationCount !== 1 ? 's' : ''} waiting for your review
              </h2>
            </div>
            <Link
              href="/admin/contractors"
              className="inline-flex h-8 items-center rounded-lg bg-amber-600 px-3 text-xs font-black text-white transition hover:bg-amber-700"
            >
              Review all →
            </Link>
          </div>
          <ul className="divide-y divide-amber-100">
            {(pendingContractors ?? []).map((c: any) => (
              <li key={c.user_id}>
                <Link
                  href={`/admin/contractors/${c.user_id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-amber-100/60"
                >
                  <div>
                    <span className="text-sm font-bold text-amber-900">{c.company_name}</span>
                    <span className="ml-2 text-[11px] text-amber-600">{formatWhen(c.created_at)}</span>
                  </div>
                  <span className="text-xs font-black text-amber-600">Review →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6">
        <Panel
          title="Needs your attention"
          description={`${inbox.reduce((s, i) => s + (Number(i.count) || 0), 0)} item(s) open across the marketplace.`}
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
          description="Filter by date or contractor — full history in the audit log."
          right={
            <Link
              href="/admin/events"
              className="text-xs font-black text-orange-600 hover:underline"
            >
              All events →
            </Link>
          }
        >
          {activityRows.length === 0 ? (
            <EmptyRow>No activity recorded yet.</EmptyRow>
          ) : (
            <OverviewActivityFilter rows={activityRows} actorOptions={actorOptions} />
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
              <JumpRow href="/admin/payments" label="Payments & escrow" />
              <JumpRow href="/admin/conversations" label="Conversations" />
              <JumpRow href="/admin/flags" label="Moderation flags" />
              <JumpRow href="/admin/disputes" label="Disputes" />
              <JumpRow href="/admin/support" label="Support cases" />
              <JumpRow href="/admin/events" label="Audit log" />
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
