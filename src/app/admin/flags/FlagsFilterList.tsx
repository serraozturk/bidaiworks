'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pill, EmptyRow, formatWhen } from '@/components/admin/ui';
import { AdminActionButton } from '@/components/admin/AdminActionButton';
import { withinDateRange, type DateRangeValue } from '@/components/admin/FilterBar';

type TargetLink = { href: string; label: string };

type Row = {
  id: string;
  kind: string;
  severity: string;
  summary: string;
  detail: any;
  created_at: string;
  user_id: string | null;
  userRole: string | null;
  userName: string | null;
  userSuspended: boolean;
  userFlagCount: number;
  targetLabel: string;
  targetLinks: TargetLink[];
};

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

export default function FlagsFilterList({
  rows,
  actionFlagAction,
  dismissFlagAction,
  warnUserAction,
  suspendUserAction,
}: {
  rows: Row[];
  actionFlagAction: (formData: FormData) => void;
  dismissFlagAction: (formData: FormData) => void;
  warnUserAction: (formData: FormData) => void;
  suspendUserAction: (formData: FormData) => void;
}) {
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>('all');

  const filtered = useMemo(() => {
    let list = rows;
    if (severity !== 'all') list = list.filter((r) => (r.severity ?? 'normal') === severity);
    if (dateRange !== 'all') list = list.filter((r) => withinDateRange(r.created_at, dateRange));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.summary.toLowerCase().includes(q) ||
          r.kind.toLowerCase().includes(q) ||
          r.targetLabel.toLowerCase().includes(q) ||
          (r.userName ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, severity, dateRange, search]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <h2 className="text-sm font-black text-slate-900">
          Open flags
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
            {filtered.length}
          </span>
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search summary, kind, user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-56 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />

          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 focus:border-orange-400 focus:outline-none"
          >
            {SEVERITY_OPTIONS.map((opt) => (
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
        <EmptyRow>No flags match the current filter.</EmptyRow>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((f) => (
            <li key={f.id} className="px-4 py-5">

              {/* Flag header */}
              <div className="flex flex-wrap items-center gap-2">
                <Pill value={f.kind.replaceAll('_', ' ')} />
                <SeverityPill value={f.severity ?? 'normal'} />
                <span className="text-sm font-black text-slate-900">{f.summary}</span>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-slate-400">
                Opened {formatWhen(f.created_at)} · {f.targetLabel}
              </p>

              {/* Target quick-links */}
              {f.targetLinks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {f.targetLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {l.label} →
                    </Link>
                  ))}
                </div>
              )}

              {/* ── User context card ── shown whenever the flag is tied to a user */}
              {f.user_id && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Avatar */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-600">
                      {(f.userName ?? '?').charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-900">
                          {f.userName ?? 'Unknown user'}
                        </span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-600">
                          {f.userRole ?? 'user'}
                        </span>
                        {f.userSuspended && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700">
                            🚫 Suspended
                          </span>
                        )}
                        {f.userFlagCount > 1 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-700">
                            ⚑ {f.userFlagCount} flags total
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Profile link */}
                    <Link
                      href={
                        f.userRole === 'contractor'
                          ? `/admin/contractors/${f.user_id}`
                          : `/admin/users/${f.user_id}`
                      }
                      className="shrink-0 text-xs font-black text-orange-600 hover:underline"
                    >
                      View profile →
                    </Link>
                  </div>

                  {/* Actions — warn or suspend */}
                  {!f.userSuspended && (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <form action={warnUserAction}>
                        <input type="hidden" name="flagId" value={f.id} />
                        <input type="hidden" name="userId" value={f.user_id} />
                        <input type="hidden" name="userRole" value={f.userRole ?? ''} />
                        <input
                          name="reason"
                          placeholder="Warning reason (optional)..."
                          defaultValue={f.summary}
                          className="mb-2 h-9 w-full rounded-xl border border-amber-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                        />
                        <AdminActionButton
                          tone="orange"
                          confirm="Send a formal warning email and close this flag? You will be taken to the user's profile."
                        >
                          ⚠ Warn user
                        </AdminActionButton>
                      </form>

                      <form action={suspendUserAction}>
                        <input type="hidden" name="flagId" value={f.id} />
                        <input type="hidden" name="userId" value={f.user_id} />
                        <input type="hidden" name="userRole" value={f.userRole ?? ''} />
                        <input
                          name="reason"
                          placeholder="Suspension reason (shown to user)..."
                          defaultValue={f.summary}
                          className="mb-2 h-9 w-full rounded-xl border border-red-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100"
                        />
                        <AdminActionButton
                          tone="rose"
                          confirm="Suspend this account? The user is locked out immediately. You will be taken to their profile."
                        >
                          🚫 Suspend account
                        </AdminActionButton>
                      </form>
                    </div>
                  )}

                  {f.userSuspended && (
                    <p className="mt-2 text-xs font-bold text-red-600">
                      This account is already suspended. Use the profile page to restore it.
                    </p>
                  )}
                </div>
              )}

              {/* Generic close actions */}
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <form action={actionFlagAction}>
                  <input type="hidden" name="id" value={f.id} />
                  {f.user_id && <input type="hidden" name="userId" value={f.user_id} />}
                  <input
                    name="note"
                    placeholder="What did you do? (optional note)"
                    className="mb-2 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                  <AdminActionButton tone="emerald" confirm="Close this flag as actioned?">
                    ✓ Mark actioned and close
                  </AdminActionButton>
                </form>

                <form action={dismissFlagAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <input
                    name="note"
                    placeholder="Why dismiss? (optional)"
                    className="mb-2 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  />
                  <AdminActionButton tone="slate" confirm="Dismiss this flag without action?">
                    Dismiss (no action)
                  </AdminActionButton>
                </form>
              </div>

            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SeverityPill({ value }: { value: string }) {
  const cls =
    value === 'urgent'
      ? 'bg-red-100 text-red-800'
      : value === 'high'
        ? 'bg-orange-100 text-orange-800'
        : value === 'low'
          ? 'bg-slate-100 text-slate-600'
          : 'bg-amber-100 text-amber-800';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${cls}`}
    >
      {value}
    </span>
  );
}
