'use client';

import { useFormStatus } from 'react-dom';
import { replySupportFromAdmin, resolveSupportReport } from '@/app/admin/actions';

export default function AdminSupportActions({ reportId }: { reportId: string }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">
              Reply to reporter
            </div>
            <h3 className="mt-0.5 text-sm font-black text-slate-900">
              Continue the investigation
            </h3>
          </div>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Posts a visible message back to the reporter and emails them. Use
          this to ask for more detail or to share progress without closing
          the case.
        </p>

        <form action={replySupportFromAdmin} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={reportId} />

          <textarea
            name="body"
            required
            minLength={1}
            maxLength={4000}
            rows={4}
            placeholder="Write the next message to the reporter..."
            className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold leading-6 text-slate-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />

          <SubmitButton tone="orange" label="Send reply" pendingLabel="Sending..." />
        </form>
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="text-xs font-black uppercase tracking-wide text-emerald-700">
          Close the case
        </div>
        <h3 className="mt-0.5 text-sm font-black text-emerald-900">
          Mark as resolved
        </h3>
        <p className="mt-1 text-xs leading-5 text-emerald-900/80">
          Resolves the case and stops further reply notifications. Add an
          optional summary the reporter will see.
        </p>

        <form action={resolveSupportReport} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={reportId} />

          <textarea
            name="note"
            maxLength={2000}
            rows={3}
            placeholder="Summary of what was done (optional, visible to the reporter)..."
            className="block w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />

          <SubmitButton tone="emerald" label="Resolve case" pendingLabel="Resolving..." />
        </form>
      </section>
    </div>
  );
}

function SubmitButton({
  tone,
  label,
  pendingLabel,
}: {
  tone: 'orange' | 'emerald';
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  const classes =
    tone === 'orange'
      ? 'bg-[#f45112] text-white hover:bg-[#d94406]'
      : 'bg-emerald-600 text-white hover:bg-emerald-700';
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${classes}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
