import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { formatCurrency, relativeTime } from '@/lib/utils';
import WithdrawCard from './withdraw-card';
import { countUnreadConversations } from '@/lib/unread';

export default async function ContractorEarningsPage() {
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

  const [
    { data: paymentRows, error: paymentsError },
    { data: withdrawals, error: withdrawalsError },
    conversationCount,
    { count: pendingOfferCount },
  ] = await Promise.all([
    supabase
  .from('payments')
  .select(`
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
    refunded_at,
    created_at
  `)
  .eq('payee_id', user.id)
  .order('created_at', { ascending: false }),

    supabase
      .from('withdrawals')
      .select('id, amount, status, bank_name, requested_at, completed_at')
      .eq('contractor_id', user.id)
      .order('requested_at', { ascending: false }),

    countUnreadConversations(supabase, user.id, 'contractor'),

   supabase
  .from('offers')
  .select('id', { count: 'exact', head: true })
  .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
  .in('status', ['pending', 'payment_pending', 'countered']),
  ]);

  if (paymentsError) {
    console.error('Contractor earnings payments query error:', paymentsError);
    throw new Error(paymentsError.message);
  }

  if (withdrawalsError) {
    console.error('Contractor withdrawals query error:', withdrawalsError);
    throw new Error(withdrawalsError.message);
  }
  const paymentRowsSafe = (paymentRows ?? []) as any[];

const offerIds = Array.from(
  new Set(
    paymentRowsSafe
      .map((payment) => payment.offer_id)
      .filter((id): id is string => Boolean(id)),
  ),
);

const projectIds = Array.from(
  new Set(
    paymentRowsSafe
      .map((payment) => payment.project_id)
      .filter((id): id is string => Boolean(id)),
  ),
);

let offersById = new Map<string, any>();
let projectsById = new Map<string, any>();

if (offerIds.length > 0) {
  const { data: offerRows, error: offersError } = await supabase
    .from('offers')
    .select(`
      id,
      project_id,
      amount,
      timeline_days,
      status,
      included_items,
      excluded_items,
      notes,
      scope_summary,
      message
    `)
    .in('id', offerIds);

  if (offersError) {
    console.error('Contractor earnings offers query error:', offersError);
    throw new Error(offersError.message);
  }

  offersById = new Map(
    ((offerRows ?? []) as any[]).map((offer) => [offer.id, offer]),
  );
}

if (projectIds.length > 0) {
  const { data: projectRows, error: projectsError } = await supabase
    .from('projects')
    .select(`
      id,
      title,
      status,
      payment_status,
      paid_at,
      completed_at,
      zip_code,
      city,
      state,
      homeowner_id,
      categories(name)
    `)
    .in('id', projectIds);

  if (projectsError) {
    console.error('Contractor earnings projects query error:', projectsError);
    throw new Error(projectsError.message);
  }

  projectsById = new Map(
    ((projectRows ?? []) as any[]).map((project) => [project.id, project]),
  );
}
  

  const payments = paymentRowsSafe.filter((payment) => {
  const project = projectsById.get(payment.project_id);

  return (
    project &&
    ['held', 'released', 'refunded', 'disputed'].includes(payment.status)
  );
});

  const heldRows = payments.filter((payment) => payment.status === 'held');

  const releasedRows = payments.filter(
    (payment) => payment.status === 'released',
  );

  const disputedRows = payments.filter(
    (payment) => payment.status === 'disputed',
  );

  const refundedRows = payments.filter(
    (payment) => payment.status === 'refunded',
  );

  const withdrawalRows = (withdrawals ?? []) as any[];

  const escrowTotal = heldRows.reduce((sum, payment) => {
  const offer = payment.offer_id ? offersById.get(payment.offer_id) : null;

  return sum + contractorNetAmount(payment, offer);
}, 0);

const releasedTotal = releasedRows.reduce((sum, payment) => {
  const offer = payment.offer_id ? offersById.get(payment.offer_id) : null;

  return sum + contractorNetAmount(payment, offer);
}, 0);

const lifetimeFees = payments.reduce((sum, payment) => {
  const offer = payment.offer_id ? offersById.get(payment.offer_id) : null;

  return sum + contractorFeeAmount(payment, offer);
}, 0);

const lifetimeNet = payments.reduce((sum, payment) => {
  const offer = payment.offer_id ? offersById.get(payment.offer_id) : null;

  return sum + contractorNetAmount(payment, offer);
}, 0);
  const totalWithdrawn = withdrawalRows
    .filter((withdrawal) =>
      ['completed', 'pending', 'processing'].includes(withdrawal.status),
    )
    .reduce((sum, withdrawal) => sum + Number(withdrawal.amount ?? 0), 0);

  const availableTotal = Math.max(0, releasedTotal - totalWithdrawn);


  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role="contractor"
          active="earnings"
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
                      Earnings & balance
                    </p>

                    <h1 className="mt-2 text-3xl font-black tracking-tight">
                      Your money on bidAI
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Paid jobs are held in escrow until completion. Released
                      funds become available for withdrawal.
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
                <BalanceCard
                  label="Available"
                  value={formatCurrency(availableTotal)}
                  hint={`${releasedRows.length} released payment${
                    releasedRows.length === 1 ? '' : 's'
                  }`}
                  accent
                />

                <BalanceCard
                  label="In escrow"
                  value={formatCurrency(escrowTotal)}
                  hint={`${heldRows.length} held payment${
                    heldRows.length === 1 ? '' : 's'
                  }`}
                />

                <BalanceCard
                  label="Lifetime net"
                  value={formatCurrency(lifetimeNet)}
                  hint="After commitment fees"
                />

                <BalanceCard
                  label="Commitment fees"
                  value={formatCurrency(lifetimeFees)}
                  hint="Recorded on paid jobs"
                />
              </div>
            </header>

            {(disputedRows.length > 0 || refundedRows.length > 0) && (
              <section className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <div className="text-xs font-black uppercase tracking-wide text-amber-800">
                  Payment attention
                </div>

                <p className="mt-2 text-sm leading-6 text-amber-950/80">
                  {disputedRows.length} disputed and {refundedRows.length}{' '}
                  refunded payment record
                  {disputedRows.length + refundedRows.length === 1 ? '' : 's'}{' '}
                  exist in your earnings history.
                </p>
              </section>
            )}

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                <PaymentSection
  title="Available to withdraw"
  description="Released payments that can be withdrawn to your bank."
  rows={releasedRows}
  statusLabel="Released"
  emptyText="No released funds yet. Funds become available after the homeowner marks the project complete."
  projectsById={projectsById}
  offersById={offersById}
/>

<PaymentSection
  title="In escrow"
  description="Paid jobs currently held by bidAI until project completion."
  rows={heldRows}
  statusLabel="Held"
  emptyText="No funds in escrow yet. Paid jobs will appear here after homeowner checkout."
  projectsById={projectsById}
  offersById={offersById}
/>

                {withdrawalRows.length > 0 && (
                  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <SectionHeader
                      title="Withdrawal history"
                      subtitle="Your payout requests and bank transfer status."
                      count={withdrawalRows.length}
                    />

                    <div className="divide-y divide-slate-100">
                      {withdrawalRows.map((withdrawal) => (
                        <div
                          key={withdrawal.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-[#0f172a]">
                                {withdrawal.bank_name ?? 'Bank account'}
                              </span>

                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-black capitalize ${withdrawalStatusClass(
                                  withdrawal.status,
                                )}`}
                              >
                                {withdrawal.status}
                              </span>
                            </div>

                            <p className="mt-0.5 text-xs font-semibold text-slate-500">
                              Requested{' '}
                              {withdrawal.requested_at
                                ? relativeTime(withdrawal.requested_at)
                                : 'recently'}
                              {withdrawal.completed_at
                                ? ` · completed ${relativeTime(
                                    withdrawal.completed_at,
                                  )}`
                                : ''}
                            </p>
                          </div>

                          <div className="text-sm font-black text-[#0f172a]">
                            {formatCurrency(withdrawal.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <aside className="space-y-4">
                <WithdrawCard
                  availableAmount={availableTotal}
                  completedJobs={releasedRows.length}
                />

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-black text-[#0f172a]">
                    How payout works
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Homeowner payments are held in bidAI escrow. Your contractor
                    commitment fee is recorded when checkout is completed. Funds
                    become withdrawable after the project is marked complete.
                  </p>

                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Current available
                    </div>

                    <div className="mt-1 text-2xl font-black text-[#0f172a]">
                      {formatCurrency(availableTotal)}
                    </div>
                  </div>
                </section>
              </aside>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function BalanceCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="border-b border-slate-100 px-5 py-4 md:border-b-0 md:border-r md:last:border-r-0">
      <div
        className={[
          'text-[10px] font-black uppercase tracking-wide',
          accent ? 'text-[#f4510b]' : 'text-slate-500',
        ].join(' ')}
      >
        {label}
      </div>

      <div className="mt-1 text-2xl font-black tracking-tight text-[#0f172a]">
        {value}
      </div>

      <div className="mt-0.5 text-xs font-semibold text-slate-500">
        {hint}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-black text-[#0f172a]">{title}</h2>

        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>

      <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
        {count}
      </div>
    </div>
  );
}

function PaymentSection({
  title,
  description,
  rows,
  statusLabel,
  emptyText,
  projectsById,
  offersById,
}: {
  title: string;
  description: string;
  rows: any[];
  statusLabel: string;
  emptyText: string;
  projectsById: Map<string, any>;
  offersById: Map<string, any>;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <SectionHeader title={title} subtitle={description} count={rows.length} />

      {rows.length === 0 ? (
        <div className="px-5 py-10 text-sm leading-6 text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((payment) => {
           const project = projectsById.get(payment.project_id);
const offer = payment.offer_id ? offersById.get(payment.offer_id) : null;

            const net = contractorNetAmount(payment, offer);
const fee = contractorFeeAmount(payment, offer);
            const gross = Number(payment.project_amount ?? offer?.amount ?? 0);

            return (
              <div key={payment.id} className="px-5 py-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-black text-[#0f172a]">
                        {project?.title ?? 'Project'}
                      </h3>

                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-600">
                        {statusLabel}
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {categoryName(project?.categories) ?? 'Renovation'}
                      {project?.zip_code ? ` · ZIP ${project.zip_code}` : ''}
                      {project?.city ? ` · ${project.city}` : ''}
                      {payment.held_at
                        ? ` · held ${relativeTime(payment.held_at)}`
                        : ''}
                      {payment.released_at
                        ? ` · released ${relativeTime(payment.released_at)}`
                        : ''}
                    </p>

                    <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-3">
                      <MoneyMini label="Gross" value={formatCurrency(gross)} />
                      <MoneyMini
                        label="Commitment fee"
                        value={`-${formatCurrency(fee)}`}
                      />
                      <MoneyMini label="Net" value={formatCurrency(net)} strong />
                    </div>
                  </div>

                  <div className="grid gap-2 self-start">
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
                        Message
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MoneyMini({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <div className="font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div
        className={`mt-0.5 ${
          strong ? 'font-black text-[#0f172a]' : 'font-bold text-slate-700'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function contractorFeeAmount(payment: any, offer?: any): number {
  const projectAmount = Number(payment.project_amount ?? offer?.amount ?? 0);
  const storedFee = Number(payment.contractor_fee_amount ?? 0);

  if (storedFee > 0) return storedFee;

  return Math.round(projectAmount * 0.05 * 100) / 100;
}

function contractorNetAmount(payment: any, offer?: any): number {
  const payout = Number(
    payment.contractor_payout_amount ?? payment.deposit_amount ?? 0,
  );

  if (payout > 0) return payout;

  const projectAmount = Number(payment.project_amount ?? offer?.amount ?? 0);

  return Math.max(0, projectAmount - contractorFeeAmount(payment, offer));
}

function withdrawalStatusClass(status: string) {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  if (status === 'processing') return 'bg-blue-100 text-blue-700';
  return 'bg-amber-100 text-amber-700';
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function categoryName(value: any): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value.name ?? null;
}