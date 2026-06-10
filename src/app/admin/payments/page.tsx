import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AdminPageHeader,
  Panel,
  Pill,
  EmptyRow,
  StatCard,
  formatWhen,
  money,
} from '@/components/admin/ui';
import { AdminActionButton } from '@/components/admin/AdminActionButton';
import {
  refundProjectEscrow,
  releaseProjectEscrow,
} from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentsPage() {
  const db = createAdminClient();

  const [
    { data: payments, error: paymentsError },
    { data: withdrawals, error: withdrawalsError },
    { data: projects },
    { data: profiles },
  ] = await Promise.all([
    db
      .from('payments')
      .select(
        `
        id,
        project_id,
        payer_id,
        payee_id,
        total_amount,
        project_amount,
        protection_hold_amount,
        contractor_fee_amount,
        contractor_payout_amount,
        status,
        created_at
      `,
      )
      .order('created_at', { ascending: false }),

    db
      .from('withdrawals')
      .select('id, contractor_id, amount, status, requested_at, completed_at')
      .order('requested_at', { ascending: false }),

    db.from('projects').select('id, title'),

    db.from('profiles').select('id, full_name'),
  ]);

  if (paymentsError) {
    console.error('Admin payments query error:', paymentsError);
    throw new Error(paymentsError.message);
  }

  if (withdrawalsError) {
    console.error('Admin withdrawals query error:', withdrawalsError);
    throw new Error(withdrawalsError.message);
  }

  const paymentRows = payments ?? [];
  const withdrawalRows = withdrawals ?? [];

  const projectById = new Map(
    (projects ?? []).map((project) => [project.id, project.title]),
  );

  const nameById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name]),
  );

  const sum = (
    list: any[],
    field: string,
    filter?: (payment: any) => boolean,
  ) =>
    list
      .filter((payment) => (filter ? filter(payment) : true))
      .reduce((total, payment) => total + Number(payment[field] ?? 0), 0);

  const escrowHeld = sum(
    paymentRows,
    'total_amount',
    (payment) => payment.status === 'held',
  );

  const released = sum(
    paymentRows,
    'total_amount',
    (payment) => payment.status === 'released',
  );

  const refunded = sum(
    paymentRows,
    'total_amount',
    (payment) => payment.status === 'refunded',
  );

  const feesCollected = sum(
    paymentRows,
    'contractor_fee_amount',
    (payment) =>
      payment.status === 'held' || payment.status === 'released',
  );

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Finance"
        title="Payments & escrow"
        description="Every homeowner payment, escrow balance, commitment fee and contractor withdrawal."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="In escrow (held)"
          value={money(escrowHeld)}
          tone="brand"
        />

        <StatCard label="Released" value={money(released)} tone="success" />

        <StatCard label="Refunded" value={money(refunded)} tone="danger" />

        <StatCard
          label="Commitment fees"
          value={money(feesCollected)}
          tone="success"
        />
      </div>

      <Panel
        title="Homeowner payments"
        description={`${paymentRows.length} record(s)`}
      >
        {paymentRows.length === 0 ? (
          <EmptyRow>No payments recorded.</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5">Project</th>
                  <th className="px-4 py-2.5">Payer</th>
                  <th className="px-4 py-2.5">Payee</th>
                  <th className="px-4 py-2.5">Total</th>
                  <th className="px-4 py-2.5">Project amt</th>
                  <th className="px-4 py-2.5">Protection</th>
                  <th className="px-4 py-2.5">Fee (8%)</th>
                  <th className="px-4 py-2.5">Payout</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Controls</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {paymentRows.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/projects/${payment.project_id}`}
                        className="font-bold text-slate-900 hover:text-orange-600"
                      >
                        {projectById.get(payment.project_id) ?? 'Project'}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {nameById.get(payment.payer_id) ?? '—'}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {nameById.get(payment.payee_id) ?? '—'}
                    </td>

                    <td className="px-4 py-3 font-black text-slate-900">
                      {money(payment.total_amount)}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {money(payment.project_amount)}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {money(payment.protection_hold_amount)}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {money(payment.contractor_fee_amount)}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {money(payment.contractor_payout_amount)}
                    </td>

                    <td className="px-4 py-3">
                      <Pill value={payment.status} />
                    </td>

                    <td className="px-4 py-3 text-slate-500">
                      {formatWhen(payment.created_at)}
                    </td>

                    <td className="px-4 py-3">
                      {payment.status === 'held' ? (
                        <div className="flex flex-wrap gap-2">
                          <form action={releaseProjectEscrow}>
                            <input
                              type="hidden"
                              name="projectId"
                              value={payment.project_id}
                            />

                            <AdminActionButton
                              tone="emerald"
                              confirm="Release this escrow?"
                            >
                              Release
                            </AdminActionButton>
                          </form>

                          <form action={refundProjectEscrow}>
                            <input
                              type="hidden"
                              name="projectId"
                              value={payment.project_id}
                            />

                            <AdminActionButton
                              tone="rose"
                              confirm="Refund this escrow?"
                            >
                              Refund
                            </AdminActionButton>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">
                          Closed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="mt-5">
        <Panel
          title="Contractor withdrawals"
          description={`${withdrawalRows.length} record(s)`}
        >
          {withdrawalRows.length === 0 ? (
            <EmptyRow>No withdrawals requested.</EmptyRow>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5">Contractor</th>
                    <th className="px-4 py-2.5">Amount</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Requested</th>
                    <th className="px-4 py-2.5">Completed</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {withdrawalRows.map((withdrawal) => (
                    <tr key={withdrawal.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {nameById.get(withdrawal.contractor_id) ??
                          'Contractor'}
                      </td>

                      <td className="px-4 py-3 font-black text-slate-900">
                        {money(withdrawal.amount)}
                      </td>

                      <td className="px-4 py-3">
                        <Pill value={withdrawal.status} />
                      </td>

                      <td className="px-4 py-3 text-slate-500">
                        {withdrawal.requested_at
                          ? formatWhen(withdrawal.requested_at)
                          : '—'}
                      </td>

                      <td className="px-4 py-3 text-slate-500">
                        {withdrawal.completed_at
                          ? formatWhen(withdrawal.completed_at)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}