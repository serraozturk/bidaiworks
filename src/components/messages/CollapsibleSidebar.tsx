'use client';

import { useState } from 'react';
import { DashboardSidebar } from '@/components/DashboardSidebar';

type Props = {
  role: 'homeowner' | 'contractor';
  active:
    | 'dashboard'
    | 'projects'
    | 'messages'
    | 'quotes'
    | 'compare'
    | 'contractors'
    | 'reviews'
    | 'settings'
    | 'leads'
    | 'offers'
    | 'jobs'
    | 'history'
    | 'earnings'
    | 'profile'
    | 'support';
  messageCount?: number;
  offerCount?: number;
};

/**
 * Messages is the highest-value screen - chat + the deal panel both need
 * room. Rather than reserve a permanent 252px column for the dashboard nav
 * here, collapse it into a hamburger-triggered overlay drawer. Other pages
 * keep using <DashboardSidebar> directly and are unaffected.
 */
export function CollapsibleSidebar(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="fixed left-3 top-3 z-40 grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 lg:flex"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full shadow-2xl">
            <DashboardSidebar {...props} />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="absolute left-[264px] top-3 grid h-8 w-8 place-items-center rounded-lg bg-white/90 text-slate-600 shadow-sm hover:bg-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
