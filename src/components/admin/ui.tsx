import Link from 'next/link';

/** Page header used at the top of every admin screen. */
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-600">
          {eyebrow}
        </div>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    default: 'text-slate-900',
    brand: 'text-orange-600',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-rose-600',
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-900/5">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-black tracking-tight ${toneClass}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] font-semibold text-slate-400">{hint}</div>}
    </div>
  );
}

const PILL_TONES: Record<string, string> = {
  open: 'bg-sky-50 text-sky-700',
  negotiating: 'bg-amber-50 text-amber-700',
  in_review: 'bg-amber-50 text-amber-700',
  quoted: 'bg-amber-50 text-amber-700',
  pending_payment: 'bg-orange-50 text-orange-700',
  paid: 'bg-violet-50 text-violet-700',
  in_progress: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-500',
  expired: 'bg-slate-100 text-slate-500',
  draft: 'bg-slate-100 text-slate-500',
  held: 'bg-violet-50 text-violet-700',
  released: 'bg-emerald-50 text-emerald-700',
  refunded: 'bg-rose-50 text-rose-700',
  due: 'bg-orange-50 text-orange-700',
  none: 'bg-slate-100 text-slate-500',
  accepted: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-slate-100 text-slate-500',
  pending: 'bg-amber-50 text-amber-700',
  payment_pending: 'bg-orange-50 text-orange-700',
};

export function Pill({ value }: { value: string | null | undefined }) {
  const key = String(value ?? 'none').toLowerCase();
  const tone = PILL_TONES[key] ?? 'bg-slate-100 text-slate-600';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black capitalize ${tone}`}
    >
      {String(value ?? '—').replaceAll('_', ' ')}
    </span>
  );
}

/** Section wrapper card with a header. */
export function Panel({
  title,
  description,
  children,
  right,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-sm font-semibold text-slate-400">{children}</div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
    >
      ← {label}
    </Link>
  );
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function money(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return '$0';
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
