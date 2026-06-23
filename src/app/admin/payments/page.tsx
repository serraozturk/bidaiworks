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
import {
  refundProjectEscrow,
  releaseProjectEscrow,
} from '@/app/admin/actions';
import PaymentsFilterTable from './PaymentsFilterTable';

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

  const tableRows = paymentRows.map((payment) => ({
    id: payment.id,
    project_id: payment.project_id,
    project_title: projectById.get(payment.project_id) ?? 'Project',
    payer_name: nameById.get(payment.payer_id) ?? '—',
    payee_name: nameById.get(payment.payee_id) ?? '—',
    total_amount: Number(payment.total_amount ?? 0),
    project_amount: Number(payment.project_amount ?? 0),
    protection_hold_amount: Number(payment.protection_hold_amount ?? 0),
    contractor_fee_amount: Number(payment.contractor_fee_amount ?? 0),
    contractor_payout_amount: Number(payment.contractor_payout_amount ?? 0),
    status: payment.status,
    created_at: payment.created_at,
  }));

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Finance"
        title="Payments & escrow"
        description="Every homeowner payment, escrow balance, and contractor withdrawal. Commitment fees are paid separately by contractors."
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
          label="Commitment fees (from contractors)"
          value={money(feesCollected)}
          tone="success"
        />
      </div>

      <PaymentsFilterTable
        rows={tableRows}
        releaseAction={releaseProjectEscrow}
        refundAction={refundProjectEscrow}
      />

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
