'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pill, EmptyRow, formatWhen } from '@/components/admin/ui';
import { withinDateRange, type DateRangeValue } from '@/components/admin/FilterBar';

type Row = {
  id: string;
  title: string;
  homeowner_name: string;
  category_name: string;
  status: string;
  moderation_status: string;
  payment_status: string;
  contractor_fee_status: string;
  accepted_contractor: string | null;
  offer_count: number;
  created_at: string;
  moderation_note: string | null;
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In review' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'pending_payment', label: 'Pending payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const MODERATION_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function ProjectsFilterTable({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [moderation, setModeration] = useState('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>('all');

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category_name))).sort(),
    [rows],
  );
  const [category, setCategory] = useState('all');

  const filtered = useMemo(() => {
    let list = rows;
    if (status !== 'all') list = list.filter((r) => r.status === status);
    if (moderation !== 'all') list = list.filter((r) => r.moderation_status === moderation);
    if (category !== 'all') list = list.filter((r) => r.category_name === category);
    if (dateRange !== 'all') list = list.filter((r) => withinDateRange(r.created_at, dateRange));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.homeowner_name.toLowerCase().includes(q) ||
          r.category_name.toLowerCase().includes(q) ||
          (r.accepted_contractor ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, status, moderation, category, dateRange, search]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <h2 className="text-sm font-black text-slate-900">
          Project registry
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
            {filtered.length}
          </span>
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search title, homeowner, contractor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-56 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 focus:border-orange-400 focus:outline-none"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="flex gap-1">
            {MODERATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setModeration(opt.value)}
                className={`h-8 rounded-lg px-3 text-xs font-black transition ${
                  moderation === opt.value
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 focus:border-orange-400 focus:outline-none"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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
        <EmptyRow>No projects match the current filter.</EmptyRow>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5">Project</th>
                <th className="px-4 py-2.5">Homeowner</th>
                <th className="px-4 py-2.5">Accepted by</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Moderation</th>
                <th className="px-4 py-2.5">Payment</th>
                <th className="px-4 py-2.5">Fee</th>
                <th className="px-4 py-2.5">Offers</th>
                <th className="px-4 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/projects/${project.id}`}
                      className="font-bold text-slate-900 hover:text-orange-600 hover:underline"
                    >
                      {project.title}
                    </Link>
                    {project.moderation_note && (
                      <p className="mt-1 max-w-xs truncate text-[11px] font-semibold text-slate-400">
                        {project.moderation_note}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{project.homeowner_name}</td>
                  <td className="px-4 py-3">
                    {project.accepted_contractor ? (
                      <span className="font-bold text-emerald-700">{project.accepted_contractor}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{project.category_name}</td>
                  <td className="px-4 py-3"><Pill value={project.status} /></td>
                  <td className="px-4 py-3"><Pill value={project.moderation_status} /></td>
                  <td className="px-4 py-3"><Pill value={project.payment_status} /></td>
                  <td className="px-4 py-3"><Pill value={project.contractor_fee_status} /></td>
                  <td className="px-4 py-3 font-black text-slate-900">{project.offer_count}</td>
                  <td className="px-4 py-3 text-slate-500">{formatWhen(project.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
