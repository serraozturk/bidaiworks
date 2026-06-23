'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

type Row = {
  user_id: string;
  company_name: string;
  owner_name: string;
  owner_email: string;
  city: string;
  state: string;
  verification_status: string;
  rating_avg: number | null;
  rating_count: number;
  completed_jobs_count: number;
  zip_count: number;
  offer_count: number;
  created_at: string;
  license_number: string;
  license_state: string;
  insurance_expires_at: string | null;
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending_verification', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];

const STATUS_STYLES: Record<string, string> = {
  verified: 'bg-emerald-100 text-emerald-700',
  pending_verification: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-slate-100 text-slate-500',
};

const STATUS_LABELS: Record<string, string> = {
  verified: 'Verified',
  pending_verification: 'Pending',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ContractorFilterTable({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState<'newest' | 'name' | 'jobs'>('newest');

  const filtered = useMemo(() => {
    let list = rows;

    if (statusFilter !== 'all') {
      list = list.filter((r) => r.verification_status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.company_name.toLowerCase().includes(q) ||
          r.owner_name.toLowerCase().includes(q) ||
          r.owner_email.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.state.toLowerCase().includes(q) ||
          r.license_number.toLowerCase().includes(q),
      );
    }

    if (sort === 'name') {
      list = [...list].sort((a, b) => a.company_name.localeCompare(b.company_name));
    } else if (sort === 'jobs') {
      list = [...list].sort((a, b) => b.completed_jobs_count - a.completed_jobs_count);
    }
    // newest is default order from server

    return list;
  }, [rows, search, statusFilter, sort]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <h2 className="text-sm font-black text-slate-900">
          All contractors
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
            {filtered.length}
          </span>
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Search */}
          <input
            type="search"
            placeholder="Search name, email, city, license..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-60 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />

          {/* Status filter chips */}
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`h-8 rounded-lg px-3 text-xs font-black transition ${
                  statusFilter === opt.value
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 focus:border-orange-400 focus:outline-none"
          >
            <option value="newest">Newest first</option>
            <option value="name">Name A–Z</option>
            <option value="jobs">Most jobs</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
          No contractors match the current filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Owner</th>
                <th className="px-4 py-2.5">Location</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">License</th>
                <th className="px-4 py-2.5">Insurance exp.</th>
                <th className="px-4 py-2.5">Rating</th>
                <th className="px-4 py-2.5">Jobs</th>
                <th className="px-4 py-2.5">Joined</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const isPending = c.verification_status === 'pending_verification';
                const statusStyle = STATUS_STYLES[c.verification_status] ?? 'bg-slate-100 text-slate-500';
                const statusLabel = STATUS_LABELS[c.verification_status] ?? c.verification_status;

                // Flag expired insurance
                const insuranceExpired =
                  c.insurance_expires_at && new Date(c.insurance_expires_at) < new Date();

                return (
                  <tr
                    key={c.user_id}
                    className={isPending ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50'}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{c.company_name}</span>
                        {isPending && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
                            NEW
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-700">{c.owner_name}</div>
                      <div className="text-[11px] text-slate-400">{c.owner_email}</div>
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {c.city && c.state ? `${c.city}, ${c.state}` : '—'}
                      <div className="text-[11px] text-slate-400">{c.zip_count} ZIP{c.zip_count !== 1 ? 's' : ''}</div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${statusStyle}`}>
                        {statusLabel}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div>{c.license_number}</div>
                      <div className="text-[11px] text-slate-400">{c.license_state}</div>
                    </td>

                    <td className="px-4 py-3 text-xs">
                      {c.insurance_expires_at ? (
                        <span className={insuranceExpired ? 'font-bold text-red-600' : 'text-slate-600'}>
                          {formatDate(c.insurance_expires_at)}
                          {insuranceExpired && ' ⚠'}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {c.rating_count > 0
                        ? `★ ${Number(c.rating_avg).toFixed(1)} (${c.rating_count})`
                        : <span className="text-slate-400">New</span>}
                    </td>

                    <td className="px-4 py-3 font-black text-slate-700">{c.completed_jobs_count}</td>

                    <td className="px-4 py-3 text-[11px] text-slate-400">{formatDate(c.created_at)}</td>

                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/contractors/${c.user_id}`}
                        className={`text-xs font-black hover:underline ${isPending ? 'text-amber-600' : 'text-orange-600'}`}
                      >
                        {isPending ? 'Review →' : 'Details →'}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
