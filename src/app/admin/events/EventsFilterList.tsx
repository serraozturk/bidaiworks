'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pill, EmptyRow, formatWhen } from '@/components/admin/ui';
import { FilterBar, withinDateRange, type DateRangeValue } from '@/components/admin/FilterBar';

type EventRow = {
  id: string;
  event_type: string;
  summary: string;
  actor_role: string | null;
  actor_id: string | null;
  actor_name: string | null;
  project_id: string | null;
  project_title: string | null;
  created_at: string;
};

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'project', label: 'Project' },
  { value: 'offer', label: 'Offer' },
  { value: 'payment', label: 'Payment' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'admin', label: 'Admin' },
];

function categoryOf(eventType: string): string {
  if (eventType.startsWith('admin_')) return 'admin';
  if (eventType.startsWith('contractor_')) return 'contractor';
  if (eventType.startsWith('payment_')) return 'payment';
  if (eventType.startsWith('offer_')) return 'offer';
  if (eventType.startsWith('project_')) return 'project';
  return 'other';
}

export default function EventsFilterList({
  rows,
  actorOptions,
}: {
  rows: EventRow[];
  actorOptions: { value: string; label: string }[];
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [actor, setActor] = useState('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>('all');

  const filtered = useMemo(() => {
    let list = rows;

    if (category !== 'all') {
      list = list.filter((r) => categoryOf(r.event_type) === category);
    }

    if (actor !== 'all') {
      list = list.filter((r) => r.actor_id === actor);
    }

    if (dateRange !== 'all') {
      list = list.filter((r) => withinDateRange(r.created_at, dateRange));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.summary.toLowerCase().includes(q) ||
          r.event_type.toLowerCase().includes(q) ||
          (r.project_title ?? '').toLowerCase().includes(q) ||
          (r.actor_name ?? '').toLowerCase().includes(q),
      );
    }

    return list;
  }, [rows, category, actor, dateRange, search]);

  const actorSelectOptions = [{ value: 'all', label: 'All' }, ...actorOptions];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <h2 className="text-sm font-black text-slate-900">
          Marketplace events
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
            {filtered.length}
          </span>
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search summary, project, actor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-60 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />

          <div className="flex gap-1">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCategory(opt.value)}
                className={`h-8 rounded-lg px-3 text-xs font-black transition ${
                  category === opt.value
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <select
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 focus:border-orange-400 focus:outline-none"
          >
            {actorSelectOptions.map((opt) => (
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
            <option value="90d">90 days</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyRow>No events match the current filter.</EmptyRow>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5">
                <Pill value={e.event_type.replace(/^(project|offer|payment)_/, '')} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-700">{e.summary}</p>
                <p className="text-[11px] font-semibold text-slate-400">
                  <span className="font-mono">{e.event_type}</span>
                  {e.actor_name ? ` · ${e.actor_name}` : e.actor_role ? ` · ${e.actor_role}` : ''}
                  {' · '}
                  {formatWhen(e.created_at)}
                </p>
              </div>
              {e.project_id && (
                <Link
                  href={`/admin/projects/${e.project_id}`}
                  className="shrink-0 text-xs font-black text-orange-600 hover:underline"
                >
                  {e.project_title ?? 'Project'} →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
