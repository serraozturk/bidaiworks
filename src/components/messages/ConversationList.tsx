'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { relativeTime } from '@/lib/utils';

export interface ConversationItem {
  id: string;
  projectId: string;
  partnerId: string;
  partnerName: string;
  projectTitle: string;
  projectStatus: string | undefined;
  lastMessageAt: string | null;
  unread: boolean;
  selected: boolean;
}

interface Props {
  items: ConversationItem[];
}

const FILTERS: Array<{
  value: string;
  label: string;
  match: (status: string | undefined) => boolean;
}> = [
  {
    value: 'all',
    label: 'All',
    match: () => true,
  },
  {
    value: 'negotiating',
    label: 'Negotiating',
    match: (status) =>
      status === 'open' ||
      status === 'in_review' ||
      status === 'quoted' ||
      status === 'negotiating' ||
      status === 'expired',
  },
  {
    value: 'payment',
    label: 'Payment',
    match: (status) => status === 'pending_payment',
  },
  {
    value: 'active',
    label: 'Active',
    match: (status) => status === 'paid' || status === 'in_progress',
  },
  {
    value: 'completed',
    label: 'Done',
    match: (status) => status === 'completed',
  },
];

export default function ConversationList({ items }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const activeFilter =
    FILTERS.find((item) => item.value === filter) ?? FILTERS[0];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((item) => {
      if (!activeFilter.match(item.projectStatus)) {
        return false;
      }

      if (!q) return true;

      const searchableText = [
        safeText(item.partnerName),
        safeText(item.projectTitle),
        safeText(item.projectStatus),
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(q);
    });
  }, [items, query, activeFilter]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-slate-100 px-4 pb-4">
        <div className="relative">
          <span
            className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-slate-400"
            aria-hidden
          >
            <SearchIcon />
          </span>

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            className="block h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100"
          />
        </div>

        <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
          {FILTERS.map((item) => {
            const active = filter === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-slate-950 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {visible.length === 0 ? (
          <EmptyList query={query} />
        ) : (
          <div className="space-y-1.5">
            {visible.map((item) => (
              <ConversationRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationRow({ item }: { item: ConversationItem }) {
  const displayName = safeConversationName(item.partnerName);
  const projectTitle = safeText(item.projectTitle) || 'Project conversation';
  const pill = statusPill(item.projectStatus);

  return (
    <Link
      href={`/dashboard/messages/${item.projectId}/${item.partnerId}`}
      className={`group block rounded-lg border px-3 py-3 transition ${
        item.selected
          ? 'border-slate-300 bg-slate-50 shadow-sm'
          : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Avatar name={displayName} active={item.selected} />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-sm font-semibold leading-5 text-slate-950">
                  {displayName}
                </h3>

                {item.unread && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-slate-950"
                    aria-label="Unread conversation"
                  />
                )}
              </div>

              <p className="mt-0.5 truncate text-xs text-slate-500">
                {projectTitle}
              </p>
            </div>

            <span className="shrink-0 text-[11px] font-medium text-slate-400">
              {item.lastMessageAt ? relativeTime(item.lastMessageAt) : 'New'}
            </span>
          </div>

          <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-xs text-slate-500">
              Marketplace negotiation
            </span>

            {pill && (
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${pill.tone}`}
              >
                {pill.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function Avatar({ name, active = false }: { name: string; active?: boolean }) {
  const initials = getInitials(name);

  return (
    <div
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-semibold transition ${
        active
          ? 'bg-slate-950 text-white'
          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
      }`}
    >
      {initials}
    </div>
  );
}

function EmptyList({ query }: { query: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg bg-white text-slate-400 shadow-sm">
        <MessageIcon />
      </div>

      <h3 className="mt-3 text-sm font-semibold text-slate-950">
        No conversations found
      </h3>

      <p className="mx-auto mt-1 max-w-[220px] text-xs leading-5 text-slate-500">
        {query.trim()
          ? 'Try a different contractor, customer, or project name.'
          : 'New marketplace conversations will appear here.'}
      </p>
    </div>
  );
}

function safeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeConversationName(value: string | null | undefined): string {
  const cleaned = safeText(value);

  return cleaned || 'Unknown contact';
}

function getInitials(name: string): string {
  const cleaned = safeConversationName(name);

  const initials = cleaned
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || '?';
}

function statusPill(
  status: string | undefined,
): { label: string; tone: string } | null {
  if (!status) return null;

  if (status === 'open') {
    return { label: 'Open', tone: 'bg-slate-100 text-slate-600' };
  }

  if (status === 'pending_payment') {
    return { label: 'Payment', tone: 'bg-amber-50 text-amber-700' };
  }

  if (status === 'paid') {
    return { label: 'Paid', tone: 'bg-emerald-50 text-emerald-700' };
  }

  if (status === 'in_progress') {
    return { label: 'Active', tone: 'bg-emerald-50 text-emerald-700' };
  }

  if (status === 'completed') {
    return { label: 'Done', tone: 'bg-emerald-50 text-emerald-700' };
  }

  if (status === 'cancelled') {
    return { label: 'Cancelled', tone: 'bg-slate-100 text-slate-500' };
  }

  if (status === 'expired') {
    return { label: 'Expired', tone: 'bg-red-50 text-red-700' };
  }

  if (status === 'in_review' || status === 'quoted' || status === 'negotiating') {
    return { label: 'Negotiating', tone: 'bg-amber-50 text-amber-700' };
  }

  return {
    label: readableStatus(status),
    tone: 'bg-slate-100 text-slate-600',
  };
}

function readableStatus(status: string): string {
  return status.replace('_', ' ').replace(/^./, (char) => char.toUpperCase());
}

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10.8 18.1a7.3 7.3 0 1 1 0-14.6 7.3 7.3 0 0 1 0 14.6ZM16.2 16.2 21 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M21 11.5a8.3 8.3 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.3 8.3 0 0 1-3.8-.9L3 21l1.9-5.7A8.3 8.3 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}