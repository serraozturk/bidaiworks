'use client';

import { useFormStatus } from 'react-dom';
import { replySupportFromUser } from '@/app/dashboard/actions';

export default function ReplyForm({ reportId }: { reportId: string }) {
  return (
    <form
      action={replySupportFromUser}
      className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="reportId" value={reportId} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-slate-500">
            Add a message
          </div>
          <h2 className="mt-0.5 text-sm font-black text-slate-900">
            Reply to bidAI support
          </h2>
        </div>
      </div>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        Add details, answer the team&apos;s questions, or share what
        changed. Each message goes straight to the bidAI support inbox.
      </p>

      <textarea
        name="body"
        required
        minLength={1}
        maxLength={4000}
        rows={5}
        placeholder="Write your follow-up message..."
        className="mt-3 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold leading-6 text-slate-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
      />

      <div className="mt-3 flex items-center justify-end">
        <SendButton />
      </div>
    </form>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center justify-center rounded-xl bg-[#f45112] px-4 text-xs font-black text-white transition hover:bg-[#d94406] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Sending...' : 'Send to bidAI'}
    </button>
  );
}
