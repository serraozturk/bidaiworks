'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pill, EmptyRow, formatWhen } from '@/components/admin/ui';
import { withinDateRange, type DateRangeValue } from '@/components/admin/FilterBar';

type Row = {
  id: string;
  reporter_name: string;
  reporter_role: string | null;
  project_id: string | null;
  category: string | null;
  subject: string | null;
  message: string | null;
  status: string | null;
  priority: string | null;
  requested_outcome: string | null;
  contact_preference: string | null;
  page_url: string | null;
  created_at: string;
};

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

export default function SupportFilterList({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>('all');

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category ?? 'general'))).sort(),
    [rows],
  );
  const [category, setCategory] = useState('all');

  const filtered = useMemo(() => {
    let list = rows;
    if (priority !== 'all') list = list.filter((r) => (r.priority ?? 'normal') === priority);
    if (category !== 'all') list = list.filter((r) => (r.category ?? 'general') === category);
    if (dateRange !== 'all') list = list.filter((r) => withinDateRange(r.created_at, dateRange));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.subject ?? '').toLowerCase().includes(q) ||
          (r.message ?? '').toLowerCase().includes(q) ||
          r.reporter_name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, priority, category, dateRange, search]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <h2 className="text-sm font-black text-slate-900">
          Open support cases
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
            {filtered.length}
          </span>
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search subject, message, reporter..."
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
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 focus:border-orange-400 focus:outline-none"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
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
        <EmptyRow>No support cases match the current filter.</EmptyRow>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((report) => (
            <li key={report.id} className="px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={report.status ?? 'awaiting_admin'} />
                <Pill value={report.category ?? 'general'} />
                <PriorityPill value={report.priority ?? 'normal'} />

                <Link
                  href={`/admin/support/${report.id}`}
                  className="text-sm font-black text-slate-900 hover:text-orange-600 hover:underline"
                >
                  {report.subject || 'Support request'}
                </Link>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-400">
                <span>
                  {report.reporter_name}
                  {report.reporter_role ? ` (${report.reporter_role})` : ''}
                </span>
                <span>·</span>
                <span>Opened {formatWhen(report.created_at)}</span>
                <span>·</span>
                <span>Case #{String(report.id).slice(0, 8)}</span>
                {report.project_id ? (
                  <>
                    <span>·</span>
                    <Link
                      href={`/admin/projects/${report.project_id}`}
                      className="font-black text-orange-600 hover:underline"
                    >
                      Open related project
                    </Link>
                  </>
                ) : null}
              </div>

              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                {report.message || 'No message provided.'}
              </p>

              <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                {report.requested_outcome && (
                  <InfoBox label="Requested outcome" value={report.requested_outcome} />
                )}
                {report.contact_preference && (
                  <InfoBox
                    label="Contact preference"
                    value={readableStatus(report.contact_preference)}
                  />
                )}
                {report.page_url && (
                  <InfoBox label="Page" value={report.page_url} wide />
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-500">
                  Open the case to see reporter history, related project and the full thread.
                </p>
                <Link
                  href={`/admin/support/${report.id}`}
                  className="inline-flex h-9 items-center rounded-xl bg-[#f45112] px-4 text-xs font-black text-white transition hover:bg-[#d94406]"
                >
                  Open case →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    awaiting_admin: { label: 'Awaiting bidAI', cls: 'bg-amber-100 text-amber-800' },
    awaiting_reporter: { label: 'Awaiting reporter', cls: 'bg-sky-100 text-sky-800' },
    open: { label: 'Awaiting bidAI', cls: 'bg-amber-100 text-amber-800' },
    resolved: { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-800' },
  };
  const found = map[value] ?? { label: value, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${found.cls}`}>
      {found.label}
    </span>
  );
}

function PriorityPill({ value }: { value: string }) {
  const color =
    value === 'urgent'
      ? 'bg-red-50 text-red-700 ring-red-100'
      : value === 'high'
        ? 'bg-orange-50 text-orange-700 ring-orange-100'
        : value === 'low'
          ? 'bg-slate-50 text-slate-600 ring-slate-100'
          : 'bg-amber-50 text-amber-700 ring-amber-100';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase ring-1 ${color}`}>
      {readableStatus(value)}
    </span>
  );
}

function InfoBox({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white px-3 py-2 ${wide ? 'md:col-span-2' : ''}`}>
      <span className="font-black text-slate-500">{label}: </span>
      <span className="break-all text-slate-700">{value}</span>
    </div>
  );
}

function readableStatus(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase());
}
