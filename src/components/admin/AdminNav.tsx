'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { href: string; label: string; match: (p: string) => boolean };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Inbox',
    items: [
      { href: '/admin', label: 'Overview', match: (p) => p === '/admin' },
      {
        href: '/admin/flags',
        label: 'Flags & moderation',
        match: (p) => p.startsWith('/admin/flags'),
      },
      {
        href: '/admin/disputes',
        label: 'Disputes',
        match: (p) => p.startsWith('/admin/disputes'),
      },
      {
        href: '/admin/support',
        label: 'Support inbox',
        match: (p) => p.startsWith('/admin/support'),
      },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      {
        href: '/admin/projects',
        label: 'Projects',
        match: (p) => p.startsWith('/admin/projects'),
      },
      {
        href: '/admin/contractors',
        label: 'Contractors',
        match: (p) => p.startsWith('/admin/contractors'),
      },
      {
        href: '/admin/conversations',
        label: 'Conversations',
        match: (p) => p.startsWith('/admin/conversations'),
      },
      {
        href: '/admin/payments',
        label: 'Payments & escrow',
        match: (p) => p.startsWith('/admin/payments'),
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        href: '/admin/categories',
        label: 'Categories & briefs',
        match: (p) => p.startsWith('/admin/categories'),
      },
      {
        href: '/admin/events',
        label: 'Audit log',
        match: (p) => p.startsWith('/admin/events'),
      },
    ],
  },
];

export function AdminNav({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname() ?? '/admin';

  return (
    <aside className="hidden lg:flex lg:min-h-screen lg:w-[260px] lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
      <div className="sticky top-0 flex h-screen flex-col px-3 py-4">
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#f45112]">
            bidAI
          </div>
          <div className="mt-1 text-sm font-black text-slate-900">
            Admin control
          </div>
        </div>

        <nav className="space-y-4">
          {SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {section.title}
              </div>
              {section.items.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'flex h-9 items-center rounded-lg px-3 text-[13px] font-semibold transition',
                      active
                        ? 'bg-[#f45112] text-white'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto space-y-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
              Signed in as
            </div>
            <p className="mt-1 truncate text-[11px] font-bold text-slate-600">
              {adminEmail}
            </p>
          </div>
          <Link
            href="/"
            className="flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-[12px] font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
          >
            View public site
          </Link>
        </div>
      </div>
    </aside>
  );
}
