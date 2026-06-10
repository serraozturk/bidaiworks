import Link from 'next/link';

type SidebarActive =
  | 'dashboard'
  | 'projects'
  | 'messages'
  | 'quotes'
  | 'compare'
  | 'contractors'
  | 'saved'
  | 'reviews'
  | 'settings'
  | 'leads'
  | 'offers'
  | 'jobs'
  | 'history'
  | 'earnings'
  | 'profile'
  | 'support';

type SidebarItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  active: SidebarActive;
};

interface DashboardSidebarProps {
  active: SidebarActive;
  role?: 'homeowner' | 'contractor';
  messageCount?: number;
  offerCount?: number;
  quoteCount?: number;
}

export function DashboardSidebar({
  active,
  role = 'homeowner',
  messageCount = 0,
  offerCount,
  quoteCount = 0,
}: DashboardSidebarProps) {
  const isContractor = role === 'contractor';
  const activeOfferCount = offerCount ?? quoteCount ?? 0;

  const items: SidebarItem[] = isContractor
    ? [
        {
          href: '/dashboard/contractor',
          label: 'Dashboard',
          icon: 'home',
          active: 'dashboard',
        },
        {
          href: '/dashboard/messages',
          label: 'Deal rooms',
          icon: 'message',
          active: 'messages',
          badge: messageCount,
        },
        {
          href: '/dashboard/contractor/offers',
          label: 'Offer pipeline',
          icon: 'offers',
          active: 'offers',
          badge: activeOfferCount,
        },
        {
          href: '/dashboard/contractor/jobs',
          label: 'Active jobs',
          icon: 'jobs',
          active: 'jobs',
        },
        {
          href: '/dashboard/contractor/history',
          label: 'History',
          icon: 'history',
          active: 'history',
        },
        {
          href: '/dashboard/contractor/earnings',
          label: 'Earnings',
          icon: 'earnings',
          active: 'earnings',
        },
        {
          href: '/dashboard/contractor/profile',
          label: 'Company profile',
          icon: 'settings',
          active: 'profile',
        },
        {
          href: '/dashboard/settings',
          label: 'Settings',
          icon: 'settings',
          active: 'settings',
        },
        {
          href: '/dashboard/support',
          label: 'Help & support',
          icon: 'support',
          active: 'support',
        },
      ]
    : [
        {
          href: '/dashboard/homeowner',
          label: 'Dashboard',
          icon: 'home',
          active: 'dashboard',
        },
        {
          href: '/dashboard/homeowner/new',
          label: 'New project',
          icon: 'projects',
          active: 'projects',
        },
        {
          href: '/dashboard/messages',
          label: 'Deal rooms',
          icon: 'message',
          active: 'messages',
          badge: messageCount,
        },
        {
          href: '/dashboard/homeowner/compare',
          label: 'Compare offers',
          icon: 'compare',
          active: 'compare',
          badge: activeOfferCount,
        },
        {
          href: '/dashboard/contractors',
          label: 'Contractors near you',
          icon: 'contractors',
          active: 'contractors',
        },
        {
          href: '/dashboard/homeowner/saved',
          label: 'Saved contractors',
          icon: 'bookmark',
          active: 'saved',
        },
        {
          href: '/dashboard/homeowner/reviews',
          label: 'Reviews',
          icon: 'star',
          active: 'reviews',
        },
        {
          href: '/dashboard/settings',
          label: 'Settings',
          icon: 'settings',
          active: 'settings',
        },
        {
          href: '/dashboard/support',
          label: 'Help & support',
          icon: 'support',
          active: 'support',
        },
      ];

  if (isContractor) {
    return (
      <aside className="hidden lg:flex lg:min-h-screen lg:w-[252px] lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
        <div className="sticky top-0 flex h-screen flex-col px-4 py-4">
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              Contractor
            </div>

            <div className="mt-1 text-sm font-black text-[#0f172a]">
              Workspace
            </div>
          </div>

          <nav className="space-y-1">
            {items.map((item) => {
              const isActive = item.active === active;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={[
                    'group flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-semibold transition',
                    isActive
                      ? 'bg-[#f45112] text-white'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-[#0f172a]',
                  ].join(' ')}
                >
                  <span
                    className={
                      isActive
                        ? 'text-white'
                        : 'text-slate-400 group-hover:text-slate-700'
                    }
                  >
                    <SidebarIcon name={item.icon} />
                  </span>

                  <span className="min-w-0 flex-1 truncate">
                    {item.label}
                  </span>

                  <BadgeCount value={item.badge} />
                </Link>
              );
            })}
          </nav>

        <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
              Platform rule
            </div>

            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              Before checkout, use structured offers only. Direct chat unlocks
              after payment.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:flex lg:min-h-screen lg:w-[252px] lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
      <div className="sticky top-0 flex h-screen flex-col px-4 py-4">
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
            Homeowner
          </div>

          <div className="mt-1 text-sm font-black text-[#0f172a]">
            Decision center
          </div>
        </div>

        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = item.active === active;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={[
                  'group flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-semibold transition',
                  isActive
                    ? 'bg-[#f45112] text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-[#0f172a]',
                ].join(' ')}
              >
                <span
                  className={
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 group-hover:text-slate-700'
                  }
                >
                  <SidebarIcon name={item.icon} />
                </span>

                <span className="min-w-0 flex-1 truncate">
                  {item.label}
                </span>

                <BadgeCount value={item.badge} />
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
            Safe hiring
          </div>

          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            Compare offers, accept inside bidAI, then chat after checkout.
          </p>
        </div>
      </div>
    </aside>
  );
}

function BadgeCount({
  value,
  dark = false,
}: {
  value?: number;
  dark?: boolean;
}) {
  if (!value || value <= 0) return null;

  return (
    <span
      className={[
        'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-black',
        dark ? 'bg-orange-500 text-white' : 'bg-[#f45112] text-white',
      ].join(' ')}
    >
      {value > 99 ? '99+' : value}
    </span>
  );
}

function SidebarIcon({ name }: { name: string }) {
  const common = {
    className: 'h-4 w-4',
    fill: 'none',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (name === 'home') {
    return (
      <svg {...common}>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    );
  }

  if (name === 'projects') {
    return (
      <svg {...common}>
        <path d="M4 5h16" />
        <path d="M4 12h16" />
        <path d="M4 19h16" />
      </svg>
    );
  }

  if (name === 'message') {
    return (
      <svg {...common}>
        <path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1.5-5A8 8 0 1 1 21 12z" />
      </svg>
    );
  }

  if (name === 'offers' || name === 'quotes') {
    return (
      <svg {...common}>
        <path d="M20.5 13.5 13.5 20.5a2 2 0 0 1-3 0l-7-7V4h9.5l7.5 7.5a2 2 0 0 1 0 3z" />
        <path d="M7.5 7.5h.01" />
      </svg>
    );
  }

  if (name === 'compare') {
    return (
      <svg {...common}>
        <path d="M4 6h7" />
        <path d="M4 12h12" />
        <path d="M4 18h9" />
        <path d="M17 6h3" />
        <path d="M20 6v12" />
        <path d="M17 18h3" />
      </svg>
    );
  }

  if (name === 'contractors') {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  if (name === 'jobs') {
    return (
      <svg {...common}>
        <path d="M10 6h4" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        <rect x="3" y="6" width="18" height="14" rx="2" />
        <path d="M3 12h18" />
      </svg>
    );
  }

  if (name === 'earnings') {
    return (
      <svg {...common}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="m8 15 3-4 3 2 5-7" />
      </svg>
    );
  }

  if (name === 'history') {
    return (
      <svg {...common}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 3v6h6" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (name === 'bookmark') {
    return (
      <svg {...common}>
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
    );
  }

  if (name === 'star') {
    return (
      <svg {...common}>
        <path d="m12 2 3 6 6 .9-4.5 4.4 1.1 6.2L12 16.5 6.4 19.5l1.1-6.2L3 8.9 9 8z" />
      </svg>
    );
  }

  if (name === 'support') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
