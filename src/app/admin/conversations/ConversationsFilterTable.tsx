'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pill, EmptyRow, formatWhen } from '@/components/admin/ui';
import { withinDateRange, type DateRangeValue } from '@/components/admin/FilterBar';

type Row = {
  id: string;
  project_title: string;
  project_status: string | null;
  homeowner_name: string;
  contractor_name: string;
  message_count: number;
  last_message_at: string | null;
};

export default function ConversationsFilterTable({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue>('all');
  const [sort, setSort] = useState<'recent' | 'messages'>('recent');

  const filtered = useMemo(() => {
    let list = rows;

    if (dateRange !== 'all') {
      list = list.filter((r) => withinDateRange(r.last_message_at, dateRange));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.project_title.toLowerCase().includes(q) ||
          r.homeowner_name.toLowerCase().includes(q) ||
          r.contractor_name.toLowerCase().includes(q),
      );
    }

    if (sort === 'messages') {
      list = [...list].sort((a, b) => b.message_count - a.message_count);
    }

    return list;
  }, [rows, dateRange, search, sort]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <h2 className="text-sm font-black text-slate-900">
          Deal rooms
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
            {filtered.length}
          </span>
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search project, homeowner, contractor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-60 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />

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

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 focus:border-orange-400 focus:outline-none"
          >
            <option value="recent">Most recent</option>
            <option value="messages">Most messages</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyRow>No conversations match the current filter.</EmptyRow>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5">Project</th>
                <th className="px-4 py-2.5">Homeowner</th>
                <th className="px-4 py-2.5">Contractor</th>
                <th className="px-4 py-2.5">Messages</th>
                <th className="px-4 py-2.5">Last activity</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{c.project_title}</span>
                      <Pill value={c.project_status} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.homeowner_name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.contractor_name}</td>
                  <td className="px-4 py-3 font-black text-slate-700">{c.message_count}</td>
                  <td className="px-4 py-3 text-slate-500">{formatWhen(c.last_message_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/conversations/${c.id}`}
                      className="text-xs font-black text-orange-600 hover:underline"
                    >
                      Open thread →
                    </Link>
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
