import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, relativeTime } from '@/lib/utils';
import { countUnreadConversations } from '@/lib/unread';
import { commitmentFee } from '@/lib/fees';

export default async function ContractorActiveJobsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'contractor') redirect('/dashboard');

  // Recover any lapsed commitment / payment windows first.
  await supabase.rpc('expire_stale_deals').then(() => undefined, () => undefined);

  const [
    { data: paymentRows, error: paymentsError },
    conversationCount,
    { count: pendingOfferCount },
  ] = await Promise.all([
    supabase
      .from('payments')
      .select(
        `
        id,
        project_id,
        offer_id,
        payer_id,
        payee_id,
        total_amount,
        project_amount,
        protection_hold_amount,
        contractor_fee_amount,
        contractor_payout_amount,
        deposit_amount,
        status,
        held_at,
        released_at,
        created_at
      `,
      )
      .eq('payee_id', user.id)
      .in('status', ['held', 'released'])
      .order('held_at', { ascending: false }),

    countUnreadConversations(supabase, user.id, 'contractor'),

    supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .in('status', ['pending', 'payment_pending', 'countered']),
  ]);

  if (paymentsError) {
    console.error('Contractor active jobs payments query error:', paymentsError);
  }
  const payments = (paymentRows ?? []) as any[];

  const offerIds = Array.from(
    new Set(payments.map((p) => p.offer_id).filter((id): id is string => Boolean(id))),
  );
  const projectIds = Array.from(
    new Set(payments.map((p) => p.project_id).filter((id): id is string => Boolean(id))),
  );

  let offersById = new Map<string, any>();
  let projectsById = new Map<string, any>();

  if (offerIds.length > 0) {
    const { data: offerRows } = await supabase
      .from('offers')
      .select(
        'id, project_id, amount, timeline_days, status, included_items, excluded_items, notes, scope_summary, message',
      )
      .in('id', offerIds);
    offersById = new Map(((offerRows ?? []) as any[]).map((o) => [o.id, o]));
  }

  if (projectIds.length > 0) {
    const { data: projectRows } = await supabase
      .from('projects')
      .select(
        `
        id,
        title,
        status,
        payment_status,
        paid_at,
        contractor_fee_status,
        contractor_fee_amount,
        contractor_commit_due_at,
        zip_code,
        city,
        state,
        homeowner_id,
        categories(name)
      `,
      )
      .in('id', projectIds);
    projectsById = new Map(((projectRows ?? []) as any[]).map((p) => [p.id, p]));
  }

  // Homeowner paid, but this contractor has not paid the commitment fee yet.
  const awaitingCommitment = payments.filter((payment) => {
    const project = projectsById.get(payment.project_id);
    return (
      project &&
      project.status === 'paid' &&
      project.contractor_fee_status === 'due' &&
      payment.status === 'held'
    );
  });

  // Contractor committed: live, active jobs.
  const activeJobs = payments.filter((payment) => {
    const project = projectsById.get(payment.project_id);
    return project && project.status === 'in_progress';
  });

  const activeCount = activeJobs.length;

  const grossValue = activeJobs.reduce((sum, payment) => {
    const offer = payment.offer_id ? offersById.get(payment.offer_id) : null;
    return sum + Number(payment.project_amount ?? offer?.amount ?? 0);
  }, 0);

  const escrowValue = activeJobs.reduce((sum, payment) => {
    const offer = payment.offer_id ? offersById.get(payment.offer_id) : null;
    return sum + contractorNetAmount(payment, offer);
  }, 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role="contractor"
          active="jobs"
          messageCount={conversationCount ?? 0}
          offerCount={pendingOfferCount ?? 0}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1480px] px-5 py-5">
            <header className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-white px-6 py-7 text-slate-900">
                <div className="flex flex-wrap items-end justify-between gap-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f45112]">
                      Active jobs
                    </p>

                    <h1 className="mt-2 text-3xl font-black tracking-tight">
                      Jobs you have committed to
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      A job becomes active once you pay the commitment fee. Funds
                      are held by bidAI until the project is completed.
                    </p>
                  </div>

                  <Link
                    href="/dashboard/contractor"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Back to dashboard
                  </Link>
                </div>
              </div>

              <div className="grid bg-white md:grid-cols-4">
                <Metric label="Awaiting commitment" value={String(awaitingCommitment.length)} />
                <Metric label="Active jobs" value={String(activeCount)} />
                <Metric label="Gross value" value={formatCurrency(grossValue)} />
                <Metric label="In escrow" value={formatCurrency(escrowValue)} />
              </div>
            </header>

            {awaitingCommitment.length > 0 && (
              <section className="mb-5 overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm">
                <div className="border-b border-orange-100 bg-orange-50 px-5 py-4">
                  <h2 className="text-sm font-black text-orange-900">
                    Awaiting your commitment fee
                  </h2>
                  <p className="mt-0.5 text-xs text-orange-800/80">
                    The homeowner has paid. Pay the 8% commitment fee within 48
                    hours to claim each job, unlock chat and start work.
                  </p>
                </div>

                <div className="divide-y divide-orange-100">
                  {awaitingCommitment.map((payment) => {
                    const project = projectsById.get(payment.project_id);
                    const offer = payment.offer_id ? offersById.get(payment.offer_id) : null;
                    const gross = Number(payment.project_amount ?? offer?.amount ?? 0);
                    const fee =
                      project?.contractor_fee_amount != null
                        ? Number(project.contractor_fee_amount)
                        : commitmentFee(gross);
                    const dueAt = project?.contractor_commit_due_at
                      ? new Date(project.contractor_commit_due_at)
                      : null;
                    const hoursLeft = dueAt
                      ? Math.max(0, Math.ceil((dueAt.getTime() - Date.now()) / 3600000))
                      : null;

                    return (
                      <article
                        key={payment.id}
                        className="grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_260px]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-black text-[#0f172a]">
                              {project?.title ?? 'Project'}
                            </h3>
                            <Badge tone="warning">Action needed</Badge>
                          </div>

                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {categoryName(project?.categories) ?? 'Renovation'}
                            {project?.zip_code ? ` · ZIP ${project.zip_code}` : ''}
                            {project?.paid_at
                              ? ` · homeowner paid ${relativeTime(project.paid_at)}`
                              : ''}
                          </p>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <InfoBlock label="Project amount" value={formatCurrency(gross)} />
                            <InfoBlock label="Commitment fee (8%)" value={formatCurrency(fee)} strong />
                            <InfoBlock
                              label="Time left"
                              value={hoursLeft != null ? `${hoursLeft}h` : '—'}
                            />
                          </div>
                        </div>

                        <aside className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                          <div className="text-[11px] font-black uppercase tracking-wide text-orange-700">
                            Claim this job
                          </div>
                          <p className="mt-1 text-xs leading-5 text-orange-900/75">
  Pay {formatCurrency(fee)} separately to confirm this job. After completion,
  you receive the full project amount: {formatCurrency(gross)}.
</p>
                          <Link
                            href={`/dashboard/contractor/jobs/${project?.id}/commit`}
                            className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#f45112] px-3 text-xs font-black text-white transition hover:bg-[#d94406]"
                          >
                            Pay commitment fee
                          </Link>
                        </aside>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-sm font-black text-[#0f172a]">Current jobs</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Committed, active work assigned to your company.
                  </p>
                </div>

                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                  {activeCount} active
                </div>
              </div>

              {activeJobs.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeJobs.map((payment) => {
                    const project = projectsById.get(payment.project_id);
                    const offer = payment.offer_id ? offersById.get(payment.offer_id) : null;

                    const scope = normalizeOfferScope(offer);
                    const net = contractorNetAmount(payment, offer);
                    const fee = contractorFeeAmount(payment, offer);
                    const gross = Number(payment.project_amount ?? offer?.amount ?? 0);

                    return (
                      <article key={payment.id} className="px-5 py-5">
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-black text-[#0f172a]">
                                {project?.title ?? 'Project'}
                              </h3>

                              <Badge tone="success">Committed</Badge>

                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black capitalize text-emerald-700">
                                {String(project?.status ?? 'active').replaceAll('_', ' ')}
                              </span>
                            </div>

                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {categoryName(project?.categories) ?? 'Renovation'}
                              {project?.zip_code ? ` · ZIP ${project.zip_code}` : ''}
                              {project?.city ? ` · ${project.city}` : ''}
                              {project?.paid_at ? ` · paid ${relativeTime(project.paid_at)}` : ''}
                            </p>

                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                              <InfoBlock label="Project amount" value={formatCurrency(gross)} />
<InfoBlock label="Commitment fee paid separately" value={formatCurrency(fee)} />
<InfoBlock label="Expected payout" value={formatCurrency(net)} strong />
                            </div>

                            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                              <ScopeList
                                title="Included"
                                items={scope.included}
                                emptyText="No included items saved."
                                type="included"
                              />
                              <ScopeList
                                title="Excluded"
                                items={scope.excluded}
                                emptyText="No exclusions listed."
                                type="excluded"
                              />
                            </div>

                            {scope.notes.length > 0 && (
                              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                                  Notes
                                </div>
                                <ul className="mt-2 space-y-1.5">
                                  {scope.notes.map((note, index) => (
                                    <li key={index} className="text-sm leading-6 text-slate-700">
                                      {note}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                              Job actions
                            </div>

                            <div className="mt-3 grid gap-2">
                              {project?.id && (
                                <Link
                                  href={`/dashboard/contractor/projects/${project.id}`}
                                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                                >
                                  View project
                                </Link>
                              )}

                              {project?.id && project?.homeowner_id && (
                                <Link
                                  href={`/dashboard/messages/${project.id}/${project.homeowner_id}`}
                                  className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f45112] px-3 text-xs font-black text-white transition hover:bg-[#d94406]"
                                >
                                  Message homeowner
                                </Link>
                              )}
                            </div>

                            <div className="mt-4 border-t border-slate-200 pt-3">
                              <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                                Payment status
                              </div>

                              <div className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700">
                                {payment.status === 'released' ? 'Released' : 'Held in escrow'}
                              </div>
                            </div>
                          </aside>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 px-5 py-4 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-black tracking-tight text-[#0f172a]">{value}</div>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={`mt-1 text-sm ${
          strong ? 'font-black text-[#0f172a]' : 'font-bold text-slate-700'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ScopeList({
  title,
  items,
  emptyText,
  type,
}: {
  title: string;
  items: string[];
  emptyText: string;
  type: 'included' | 'excluded';
}) {
  const mark = type === 'included' ? '✓' : '–';
  const tone =
    type === 'included' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">{title}</div>

      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-slate-500">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.slice(0, 5).map((item, index) => (
            <li
              key={`${title}-${index}`}
              className="flex gap-2 text-sm leading-5 text-slate-700"
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black ${tone}`}
              >
                {mark}
              </span>
              <span>{item}</span>
            </li>
          ))}

          {items.length > 5 && (
            <li className="pl-7 text-xs font-black text-slate-400">+{items.length - 5} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-5 py-14 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-orange-50 text-xl font-black text-[#f4510b]">
        ↗
      </div>

      <h3 className="mt-4 text-base font-black text-[#0f172a]">No active jobs yet</h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        A job becomes active after the homeowner completes checkout and you pay
        the commitment fee to claim it.
      </p>

      <Link
        href="/dashboard/contractor"
        className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-[#f45112] px-4 text-sm font-black text-white transition hover:bg-[#d94406]"
      >
        Browse leads
      </Link>
    </div>
  );
}

function contractorFeeAmount(payment: any, offer?: any): number {
  const projectAmount = Number(payment.project_amount ?? offer?.amount ?? 0);
  const storedFee = Number(payment.contractor_fee_amount ?? 0);
  if (storedFee > 0) return storedFee;
  return commitmentFee(projectAmount);
}

function contractorNetAmount(payment: any, offer?: any): number {
  const payout = Number(payment.contractor_payout_amount ?? 0);

  if (payout > 0) {
    return payout;
  }

  const projectAmount = Number(payment.project_amount ?? offer?.amount ?? 0);

  return Number.isFinite(projectAmount) ? projectAmount : 0;
}

function normalizeOfferScope(offer: any): {
  included: string[];
  excluded: string[];
  notes: string[];
} {
  const parsedMessage = parseOfferJsonMessage(offer?.message);
  const parsedScope = parseScopeSummary(offer?.scope_summary);

  const includedFromColumn = normalizeItems(offer?.included_items);
  const excludedFromColumn = normalizeItems(offer?.excluded_items);
  const notesFromColumn = normalizeItems(offer?.notes);

  return {
    included:
      includedFromColumn.length > 0
        ? includedFromColumn
        : parsedMessage.included.length > 0
          ? parsedMessage.included
          : parsedScope.included,
    excluded:
      excludedFromColumn.length > 0
        ? excludedFromColumn
        : parsedMessage.excluded.length > 0
          ? parsedMessage.excluded
          : parsedScope.excluded,
    notes:
      notesFromColumn.length > 0
        ? notesFromColumn
        : parsedMessage.message
          ? [parsedMessage.message]
          : [],
  };
}

function parseOfferJsonMessage(message?: string | null): {
  message: string | null;
  included: string[];
  excluded: string[];
} {
  if (!message) {
    return { message: null, included: [], excluded: [] };
  }

  try {
    const parsed = JSON.parse(message);
    return {
      message: typeof parsed.message === 'string' ? parsed.message : null,
      included: Array.isArray(parsed.included)
        ? parsed.included.map((item: any) => String(item).trim()).filter(Boolean)
        : [],
      excluded: Array.isArray(parsed.excluded)
        ? parsed.excluded.map((item: any) => String(item).trim()).filter(Boolean)
        : [],
    };
  } catch {
    return { message, included: [], excluded: [] };
  }
}

function parseScopeSummary(scopeSummary?: string | null): {
  included: string[];
  excluded: string[];
} {
  if (!scopeSummary) {
    return { included: [], excluded: [] };
  }

  const lines = scopeSummary
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const included: string[] = [];
  const excluded: string[] = [];

  let mode: 'included' | 'excluded' | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('included')) {
      mode = 'included';
      continue;
    }
    if (lower.startsWith('excluded')) {
      mode = 'excluded';
      continue;
    }

    const cleaned = line.replace(/^[-•]\s*/, '').trim();
    if (!cleaned) continue;
    if (mode === 'included') included.push(cleaned);
    if (mode === 'excluded') excluded.push(cleaned);
  }

  return { included, excluded };
}

function normalizeItems(value: string[] | string | null | undefined): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value)
    .split(/\n|,|;|•/)
    .map((item) => item.replace(/^[-–—]\s*/, '').trim())
    .filter(Boolean)
    .filter((item) => {
      const lowered = item.toLowerCase();
      return !['not specified', 'no exclusions listed', 'no additional notes'].includes(lowered);
    });
}

function categoryName(value: any): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value.name ?? null;
}
