'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export interface ContractorLead {
  id: string;
  isDemo: boolean;
  title: string;
  description: string;
  zip_code: string;
  city: string | null;
  state: string | null;
  category: string;
  budget_min: number | null;
  budget_max: number | null;
  start: string;
  response: string;
  size: string;
  photos: number;
  image: string;
  homeowner_id: string | null;
}

interface Props {
  leads: ContractorLead[];
}

/**
 * Renders the matched leads list with working category chips.
 * The "Review" CTA links to the real contractor project detail page so the
 * contractor can submit a quote (which automatically posts to messages).
 * Demo rows that don't have a real project id route to the lead desk so the
 * contractor still lands on a sensible page instead of a 404.
 */
export default function LeadsFilter({ leads }: Props) {
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of leads) counts.set(lead.category, (counts.get(lead.category) ?? 0) + 1);
    return ['All', ...Array.from(counts.keys())];
  }, [leads]);

  const [active, setActive] = useState<string>('All');

  const filtered = active === 'All' ? leads : leads.filter((lead) => lead.category === active);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setActive(label)}
            className={[
              'rounded-full border px-3 py-1.5 text-xs font-black transition',
              label === active
                ? 'border-orange-200 bg-orange-50 text-[#c94106]'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">
            No leads in this category yet.
          </div>
        ) : (
          filtered.map((lead, index) => (
            <LeadCard key={lead.id} lead={lead} highlighted={index === 0} />
          ))
        )}
      </div>
    </>
  );
}

function LeadCard({ lead, highlighted }: { lead: ContractorLead; highlighted: boolean }) {
  const projectHref = lead.isDemo
    ? '/dashboard/contractor'
    : `/dashboard/contractor/projects/${lead.id}`;
  const messageHref = lead.isDemo || !lead.homeowner_id
    ? '/dashboard/messages'
    : `/dashboard/messages/${lead.id}/${lead.homeowner_id}`;

  return (
    <article
      className={[
        'grid gap-3 rounded-lg border bg-white p-3.5 transition hover:shadow-md',
        'lg:grid-cols-[150px_minmax(0,1fr)_175px]',
        highlighted ? 'border-orange-300 bg-orange-50/30' : 'border-slate-200',
      ].join(' ')}
    >
      <div className="h-[112px] overflow-hidden rounded-xl bg-slate-100">
        <div
          className="h-full w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${lead.image})` }}
        />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-lg font-black tracking-tight text-slate-900">
            {lead.title}
          </h3>

          {highlighted && (
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-black text-[#c94106]">
              New
            </span>
          )}
          {lead.isDemo && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
              Demo
            </span>
          )}
        </div>

        <div className="mt-1.5 text-xs font-bold text-slate-500">
          {lead.category}
          <span className="mx-1">•</span>
          {lead.city ? `${lead.city}, ${lead.state ?? ''} • ${lead.zip_code}` : `ZIP ${lead.zip_code}`}
        </div>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
          {lead.description}
        </p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">
            {lead.response}
          </span>
          <span className="rounded-lg bg-purple-100 px-2.5 py-1 text-[11px] font-black text-purple-700">
            {lead.size}
          </span>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
            {lead.photos} photos
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-xl bg-slate-50 p-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
            Budget
          </div>

          <div className="mt-1 text-base font-black text-slate-900">
            {lead.budget_min || lead.budget_max
              ? `$${(lead.budget_min ?? 0).toLocaleString()} – $${(lead.budget_max ?? 0).toLocaleString()}`
              : 'Open budget'}
          </div>

          <div className="mt-3 text-[11px] font-black uppercase tracking-wide text-slate-500">
            Start
          </div>

          <div className="mt-1 text-sm font-black text-slate-900">
            {lead.start}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={messageHref}
            className="flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-900 hover:bg-slate-50"
          >
            Message
          </Link>

          <Link
            href={projectHref}
            className="flex h-8 items-center justify-center rounded-lg bg-[#f4510b] text-xs font-black text-white hover:bg-[#d94406]"
          >
            Review
          </Link>
        </div>
      </div>
    </article>
  );
}