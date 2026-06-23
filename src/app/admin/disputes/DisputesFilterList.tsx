'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pill, EmptyRow, formatWhen } from '@/components/admin/ui';
import { AdminActionButton } from '@/components/admin/AdminActionButton';
import { withinDateRange, type DateRangeValue } from '@/components/admin/FilterBar';

type DisputeResolution = 'released' | 'refunded' | 'dismissed';

type Row = {
  id: string;
  project_id: string;
  project_title: string;
  raised_by_role: string | null;
  category: string | null;
  priority: string | null;
  requested_resolution: string | null;
  evidence_summary: string | null;
  reason: string | null;
  created_at: string;
};

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

export default function DisputesFilterList({
  rows,
  resolveAction,
}: {
  rows: Row[];
  resolveAction: (formData: FormData) => void;
}) {
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>('all');

  const filtered = useMemo(() => {
    let list = rows;
    if (priority !== 'all') list = list.filter((r) => (r.priority ?? 'normal') === priority);
    if (dateRange !== 'all') list = list.filter((r) => withinDateRange(r.created_at, dateRange));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.project_title.toLowerCase().includes(q) ||
          (r.reason ?? '').toLowerCase().includes(q) ||
          (r.category ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, priority, dateRange, search]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <h2 className="text-sm font-black text-slate-900">
          Open disputes
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
            {filtered.length}
          </span>
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search project, reason, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-56 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 focus:border-orange-400 focus:outline-none"
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
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
        <EmptyRow>No disputes match the current filter.</EmptyRow>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((dispute) => (
            <li key={dispute.id} className="px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/projects/${dispute.project_id}`}
                  className="text-sm font-black text-slate-900 hover:text-orange-600"
                >
                  {dispute.project_title}
                </Link>

                <Pill value="open" />
                <Pill value={dispute.category ?? 'work_quality'} />
                <Pill value={dispute.priority ?? 'high'} />
              </div>

              <p className="mt-1 text-[11px] font-semibold text-slate-400">
                Raised by {dispute.raised_by_role ?? 'a participant'} ·{' '}
                {formatWhen(dispute.created_at)}
              </p>

              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                {dispute.reason || 'No reason provided.'}
              </p>

              {dispute.requested_resolution && (
                <p className="mt-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-900">
                  Requested resolution:{' '}
                  {String(dispute.requested_resolution).replaceAll('_', ' ')}
                </p>
              )}

              {dispute.evidence_summary && (
                <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                  <span className="font-black text-slate-500">Evidence: </span>
                  {dispute.evidence_summary}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <ResolveButton
                  id={dispute.id}
                  resolution="released"
                  label="Release escrow to contractor"
                  tone="emerald"
                  action={resolveAction}
                />
                <ResolveButton
                  id={dispute.id}
                  resolution="refunded"
                  label="Refund the homeowner"
                  tone="rose"
                  action={resolveAction}
                />
                <ResolveButton
                  id={dispute.id}
                  resolution="dismissed"
                  label="Dismiss dispute"
                  tone="slate"
                  action={resolveAction}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResolveButton({
  id,
  resolution,
  label,
  tone,
  action,
}: {
  id: string;
  resolution: DisputeResolution;
  label: string;
  tone: 'emerald' | 'rose' | 'slate';
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="resolution" value={resolution} />
      <input
        name="note"
        placeholder="Admin note (optional)"
        className="h-9 w-52 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
      />
      <AdminActionButton tone={tone}>{label}</AdminActionButton>
    </form>
  );
}
