'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pill, EmptyRow, formatWhen } from '@/components/admin/ui';
import { withinDateRange, type DateRangeValue } from '@/components/admin/FilterBar';

type EventRow = {
  id: string;
  event_type: string;
  summary: string;
  actor_id: string | null;
  actor_name: string | null;
  project_id: string | null;
  created_at: string;
};

/**
 * Compact activity filter for the overview page - date range + actor only.
 * Full event-type filtering and search live on the dedicated audit log page.
 */
export default function OverviewActivityFilter({
  rows,
  actorOptions,
}: {
  rows: EventRow[];
  actorOptions: { value: string; label: string }[];
}) {
  const [actor, setActor] = useState('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>('all');

  const filtered = useMemo(() => {
    let list = rows;
    if (actor !== 'all') list = list.filter((r) => r.actor_id === actor);
    if (dateRange !== 'all') list = list.filter((r) => withinDateRange(r.created_at, dateRange));
    return list.slice(0, 10);
  }, [rows, actor, dateRange]);

  const actorSelectOptions = [{ value: 'all', label: 'All' }, ...actorOptions];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as DateRangeValue)}
          className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-600 focus:border-orange-400 focus:outline-none"
        >
          <option value="all">All time</option>
          <option value="24h">Today</option>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
        </select>

        <select
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-600 focus:border-orange-400 focus:outline-none"
        >
          {actorSelectOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyRow>No activity matches this filter.</EmptyRow>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5">
                <Pill value={e.event_type.replace(/^(project|offer|payment|admin)_/, '')} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700">{e.summary}</p>
                <p className="text-[11px] font-semibold text-slate-400">
                  {formatWhen(e.created_at)}
                  {e.actor_name ? ` · ${e.actor_name}` : ''}
                  {e.project_id ? (
                    <>
                      {' · '}
                      <Link
                        href={`/admin/projects/${e.project_id}`}
                        className="text-orange-600 hover:underline"
                      >
                        project
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
