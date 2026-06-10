import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { formatCurrency, relativeTime } from '@/lib/utils';
import { countUnreadConversations } from '@/lib/unread';

export default async function ContractorHistoryPage() {
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

  if (!profile || profile.role !== 'contractor') {
    redirect('/dashboard');
  }

  const [
    { data: paymentRows, error: paymentsError },
    conversationCount,
    { count: pendingOfferCount },
  ] = await Promise.all([
    supabase
      .from('payments')
      .select(`
        id,
        project_id,
        offer_id,
        payee_id,
        project_amount,
        contractor_fee_amount,
        contractor_payout_amount,
        deposit_amount,
        status,
        held_at,
        released_at,
        created_at,
        projects(
          id,
          title,
          homeowner_id,
          status,
          payment_status,
          completed_at,
          paid_at,
          zip_code,
          city,
          state,
          categories(name)
        ),
        offers(
          id,
          amount,
          timeline_days,
          status,
          included_items,
          excluded_items,
          notes,
          scope_summary,
          message
        )
      `)
      .eq('payee_id', user.id)
      .eq('status', 'released')
      .order('released_at', { ascending: false }),

    countUnreadConversations(supabase, user.id, 'contractor'),

    supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', user.id)
      .eq('sender_role', 'contractor')
      .in('status', ['pending', 'payment_pending', 'countered']),
  ]);

  if (paymentsError) {
    console.error('Contractor history payments error:', paymentsError);
    throw new Error(paymentsError.message);
  }

  /**
   * History should be based on released payments, not on offer status.
   *
   * Why:
   * - In a marketplace, payment is the source of truth for earnings/history.
   * - Old records may have offer.status = accepted.
   * - New records may have offer.status = paid.
   * - But completed contractor history should appear when payment.status = released.
   */
  const historyRows = ((paymentRows ?? []) as any[]).filter((payment) => {
    const project = firstRow<any>(payment.projects);

    return (
      project &&
      payment.status === 'released' &&
      project.status === 'completed'
    );
  });

  const completedCount = historyRows.length;

  const grossTotal = historyRows.reduce(
    (sum, payment) =>
      sum +
      Number(payment.project_amount ?? firstRow<any>(payment.offers)?.amount ?? 0),
    0,
  );

  const netTotal = historyRows.reduce(
    (sum, payment) => sum + contractorNetAmount(payment),
    0,
  );

  const feeTotal = historyRows.reduce(
    (sum, payment) => sum + contractorFeeAmount(payment),
    0,
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role="contractor"
          active="history"
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
                      Contractor history
                    </p>

                    <h1 className="mt-2 text-3xl font-black tracking-tight">
                      Completed projects
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Released payments, completed work, final scope and payout
                      history.
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
                <Metric label="Completed jobs" value={String(completedCount)} />
                <Metric
                  label="Gross completed"
                  value={formatCurrency(grossTotal)}
                />
                <Metric label="Net released" value={formatCurrency(netTotal)} />
                <Metric label="Commitment fees" value={formatCurrency(feeTotal)} />
              </div>
            </header>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-sm font-black text-[#0f172a]">
                    Completed job history
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Projects move here after homeowner completion and escrow
                    release.
                  </p>
                </div>

                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                  {completedCount} completed
                </div>
              </div>

              {historyRows.length === 0 ? (
                <EmptyHistory />
              ) : (
                <div className="divide-y divide-slate-100">
                  {historyRows.map((payment) => {
                    const project = firstRow<any>(payment.projects);
                    const offer = firstRow<any>(payment.offers);

                    const scope = normalizeOfferScope(offer);

                    const gross = Number(payment.project_amount ?? offer?.amount ?? 0);
                    const fee = contractorFeeAmount(payment);
                    const net = contractorNetAmount(payment);

                    const releasedAt = payment.released_at ?? payment.created_at;
                    const completedAt = project?.completed_at ?? payment.released_at;

                    return (
                      <article key={payment.id} className="px-5 py-5">
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-black text-[#0f172a]">
                                {project?.title ?? 'Project'}
                              </h3>

                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                                Completed
                              </span>

                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                                Released
                              </span>
                            </div>

                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {categoryName(project?.categories) ?? 'Renovation'}
                              {project?.zip_code
                                ? ` · ZIP ${project.zip_code}`
                                : ''}
                              {project?.city ? ` · ${project.city}` : ''}
                              {completedAt
                                ? ` · completed ${relativeTime(completedAt)}`
                                : ''}
                            </p>

                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                              <InfoBlock
                                label="Gross amount"
                                value={formatCurrency(gross)}
                              />

                              <InfoBlock
                                label="Commitment fee"
                                value={`-${formatCurrency(fee)}`}
                              />

                              <InfoBlock
                                label="Released payout"
                                value={formatCurrency(net)}
                                strong
                              />
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
                                    <li
                                      key={index}
                                      className="text-sm leading-6 text-slate-700"
                                    >
                                      {note}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                              Final payout
                            </div>

                            <div className="mt-2 text-2xl font-black tracking-tight text-[#0f172a]">
                              {formatCurrency(net)}
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              {releasedAt
                                ? `Released ${relativeTime(releasedAt)}`
                                : 'Released payment'}
                            </p>

                            <div className="mt-4 grid gap-2">
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
                                  Conversation
                                </Link>
                              )}
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
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-2xl font-black tracking-tight text-[#0f172a]">
        {value}
      </div>
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
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>

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
    type === 'included'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-rose-50 text-rose-700';

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
        {title}
      </div>

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
            <li className="pl-7 text-xs font-black text-slate-400">
              +{items.length - 5} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function EmptyHistory() {
  return (
    <div className="px-5 py-14 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-emerald-50 text-xl font-black text-emerald-600">
        ✓
      </div>

      <h3 className="mt-4 text-base font-black text-[#0f172a]">
        No completed projects yet
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Completed jobs will appear here after homeowner completion and escrow
        release.
      </p>
    </div>
  );
}

function contractorFeeAmount(payment: any): number {
  const offer = firstRow<any>(payment.offers);

  const projectAmount = Number(payment.project_amount ?? offer?.amount ?? 0);
  const storedFee = Number(payment.contractor_fee_amount ?? 0);

  if (storedFee > 0) return storedFee;

  return Math.round(projectAmount * 0.05 * 100) / 100;
}

function contractorNetAmount(payment: any): number {
  const payout = Number(
    payment.contractor_payout_amount ?? payment.deposit_amount ?? 0,
  );

  if (payout > 0) return payout;

  const offer = firstRow<any>(payment.offers);
  const projectAmount = Number(payment.project_amount ?? offer?.amount ?? 0);

  return Math.max(0, projectAmount - contractorFeeAmount(payment));
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
    return {
      message: null,
      included: [],
      excluded: [],
    };
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
    return {
      message,
      included: [],
      excluded: [],
    };
  }
}

function parseScopeSummary(scopeSummary?: string | null): {
  included: string[];
  excluded: string[];
} {
  if (!scopeSummary) {
    return {
      included: [],
      excluded: [],
    };
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

  return {
    included,
    excluded,
  };
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

      return ![
        'not specified',
        'no exclusions listed',
        'no additional notes',
      ].includes(lowered);
    });
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function categoryName(value: any): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name ?? null;

  return value.name ?? null;
}