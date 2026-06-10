'use client';

import { useFormStatus } from 'react-dom';

export function AdminActionButton({
  children,
  tone = 'slate',
  confirm,
}: {
  children: React.ReactNode;
  tone?: 'emerald' | 'rose' | 'amber' | 'slate' | 'orange';
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const tones = {
    emerald: 'bg-emerald-600 text-white hover:bg-emerald-700',
    rose: 'bg-rose-600 text-white hover:bg-rose-700',
    amber: 'bg-amber-500 text-white hover:bg-amber-600',
    orange: 'bg-orange-600 text-white hover:bg-orange-700',
    slate: 'bg-slate-900 text-white hover:bg-slate-800',
  } as const;

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) {
          event.preventDefault();
        }
      }}
      className={`inline-flex min-h-9 items-center justify-center rounded-xl px-3.5 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]}`}
    >
      {pending ? 'Working...' : children}
    </button>
  );
}
