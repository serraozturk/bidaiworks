'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pill, EmptyRow, formatWhen, money } from '@/components/admin/ui';
import { AdminActionButton } from '@/components/admin/AdminActionButton';
import { withinDateRange, type DateRangeValue } from '@/components/admin/FilterBar';

type Row = {
  id: string;
  project_id: string;
  project_title: string;
  payer_name: string;
  payee_name: string;
  total_amount: number;
  project_amount: number;
  protection_hold_amount: number;
  contractor_fee_amount: number;
  contractor_payout_amount: number;
  status: string;
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'held', label: 'Held' },
  { value: 'released', label: 'Released' },
  { value: 'refunded', label: 'Refunded' },
];

export default function PaymentsFilterTable({
  rows,
  releaseAction,
  refundAction,
}: {
  rows: Row[];
  releaseAction: (formData: FormData) => void;
  refundAction: (formData: FormData) => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>('all');

  const filtered = useMemo(() => {
    let list = rows;
    if (status !== 'all') list = list.filter((r) => r.status === status);
    if (dateRange !== 'all') list = list.filter((r) => withinDateRange(r.created_at, dateRange));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.project_title.toLowerCase().includes(q) ||
          r.payer_name.toLowerCase().includes(q) ||
          r.payee_name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, status, dateRange, search]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <h2 className="text-sm font-black text-slate-900">
          Homeowner payments
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
            {filtered.length}
          </span>
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search project, payer, payee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-56 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />

          <div className="flex gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={`h-8 rounded-lg px-3 text-xs font-black transition ${
                  status === opt.value
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangeValue)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 focus:border-orange-400 focus:outline-none"
          >
            <option value="all">All time</option>
            <option value="24h">Today</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyRow>No payments match the current filter.</EmptyRow>
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
                <th className="px-4 py-2.5">Commit fee</th>
                <th className="px-4 py-2.5">Contractor payout</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/projects/${payment.project_id}`}
                      className="font-bold text-slate-900 hover:text-orange-600"
                    >
                      {payment.project_title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{payment.payer_name}</td>
                  <td className="px-4 py-3 text-slate-600">{payment.payee_name}</td>
                  <td className="px-4 py-3 font-black text-slate-900">{money(payment.total_amount)}</td>
                  <td className="px-4 py-3 text-slate-600">{money(payment.project_amount)}</td>
                  <td className="px-4 py-3 text-slate-600">{money(payment.protection_hold_amount)}</td>
                  <td className="px-4 py-3 text-slate-600">{money(payment.contractor_fee_amount)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{money(payment.project_amount)}</td>
                  <td className="px-4 py-3">
                    <Pill value={payment.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatWhen(payment.created_at)}</td>
                  <td className="px-4 py-3">
                    {payment.status === 'held' ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={releaseAction}>
                          <input type="hidden" name="projectId" value={payment.project_id} />
                          <AdminActionButton tone="emerald" confirm="Release this escrow?">
                            Release
                          </AdminActionButton>
                        </form>
                        <form action={refundAction}>
                          <input type="hidden" name="projectId" value={payment.project_id} />
                          <AdminActionButton tone="rose" confirm="Refund this escrow?">
                            Refund
                          </AdminActionButton>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">Closed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
