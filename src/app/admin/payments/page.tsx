import { createAdminClient } from '@/lib/supabase/admin';
import {
  AdminPageHeader, Panel, Pill, EmptyRow, StatCard, formatWhen, money,
} from '@/components/admin/ui';
import { refundProjectEscrow, releaseProjectEscrow } from '@/app/admin/actions';
import PaymentsFilterTable from './PaymentsFilterTable';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentsPage() {
  const db = createAdminClient();

  const [
    { data: payments, error: paymentsError },
    { data: withdrawals, error: withdrawalsError },
    { data: projects },
    { data: profiles },
    { data: contractorProfiles },
    { data: { users: authUsers } },
  ] = await Promise.all([
    db.from('payments').select('id, project_id, payer_id, payee_id, total_amount, project_amount, protection_hold_amount, contractor_fee_amount, contractor_payout_amount, status, created_at').order('created_at', { ascending: false }),
    db.from('withdrawals').select('id, contractor_id, amount, status, requested_at, completed_at').order('requested_at', { ascending: false }),
    db.from('projects').select('id, title'),
    db.from('profiles').select('id, full_name'),
    db.from('contractor_profiles').select('user_id, company_name'),
    db.auth.admin.listUsers({ perPage: 1000 }),
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

  const projectById = new Map((projects ?? []).map((p) => [p.id, p.title]));
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const companyById = new Map((contractorProfiles ?? []).map((cp) => [cp.user_id, cp.company_name]));
  const emailById = new Map((authUsers ?? []).map((u: any) => [u.id, u.email as string]));

  function displayName(userId: string | null): string {
    if (!userId) return '—';
    return companyById.get(userId) ?? nameById.get(userId) ?? emailById.get(userId) ?? userId.slice(0, 8);
  }

  const sum = (list: any[], field: string, filter?: (p: any) => boolean) =>
    list.filter((p) => (filter ? filter(p) : true)).reduce((total, p) => total + Number(p[field] ?? 0), 0);

  const escrowHeld = sum(paymentRows, 'total_amount', (p) => p.status === 'held');
  const released = sum(paymentRows, 'contractor_payout_amount', (p) => p.status === 'released');
  const refunded = sum(paymentRows, 'total_amount', (p) => p.status === 'refunded');
  const feesCollected = sum(paymentRows, 'contractor_fee_amount', (p) => p.status === 'held' || p.status === 'released');
  const totalWithdrawRequested = sum(withdrawalRows, 'amount');
  const totalWithdrawCompleted = sum(withdrawalRows, 'amount', (w) => w.status === 'completed');

  const tableRows = paymentRows.map((payment) => ({
    id: payment.id,
    project_id: payment.project_id,
    project_title: projectById.get(payment.project_id) ?? 'Project',
    payer_name: displayName(payment.payer_id),
    payee_name: displayName(payment.payee_id),
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
        description="Every homeowner payment, escrow balance, and contractor withdrawal. HO = homeowner, CTR = contractor."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="In escrow (held)" value={money(escrowHeld)} tone="brand" />
        <StatCard label="Released to contractors" value={money(released)} tone="success" />
        <StatCard label="Refunded to homeowners" value={money(refunded)} tone="danger" />
        <StatCard label="Platform fees collected" value={money(feesCollected)} tone="success" />
      </div>

      <PaymentsFilterTable rows={tableRows} releaseAction={releaseProjectEscrow} refundAction={refundProjectEscrow} />

      <div className="mt-5">
        <Panel
          title="Contractor withdrawals"
          description={`${withdrawalRows.length} record(s) · Requested: ${money(totalWithdrawRequested)} · Completed: ${money(totalWithdrawCompleted)}`}
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
                        {displayName(withdrawal.contractor_id)}
                        <span className="ml-1 rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-black text-orange-600">CTR</span>
                      </td>
                      <td className="px-4 py-3 font-black text-slate-900">{money(withdrawal.amount)}</td>
                      <td className="px-4 py-3"><Pill value={withdrawal.status} /></td>
                      <td className="px-4 py-3 text-slate-500">{withdrawal.requested_at ? formatWhen(withdrawal.requested_at) : '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{withdrawal.completed_at ? formatWhen(withdrawal.completed_at) : '—'}</td>
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
