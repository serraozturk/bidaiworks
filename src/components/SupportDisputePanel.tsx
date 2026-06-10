import Link from 'next/link';
import { raiseDispute } from '@/app/dashboard/actions';

type DisputeRow = {
  id: string;
  status: string | null;
  category?: string | null;
  priority?: string | null;
  requested_resolution?: string | null;
  reason: string | null;
  admin_note?: string | null;
  resolution?: string | null;
  created_at: string | null;
  resolved_at?: string | null;
};

const ACTIVE_DISPUTE_STATUSES = ['paid', 'in_progress', 'completed'];

export function SupportDisputePanel({
  projectId,
  projectStatus,
  role,
  backTo,
  disputes,
}: {
  projectId: string;
  projectStatus: string;
  role: 'homeowner' | 'contractor';
  backTo: string;
  disputes: DisputeRow[];
}) {
  const openDispute = disputes.find((item) => item.status !== 'resolved') ?? null;
  const canOpenDispute = ACTIVE_DISPUTE_STATUSES.includes(projectStatus) && !openDispute;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-rose-600">
            Support & dispute protection
          </div>
          <h2 className="mt-1 text-base font-black text-[#0f172a]">
            Need bidAI to step in?
          </h2>
        </div>

        <Link
          href={`/dashboard/support?projectId=${projectId}`}
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100"
        >
          Open support
        </Link>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        Use support for questions, account issues, suspicious behavior or general help.
        Open a dispute only when the paid job or escrow outcome needs formal review.
      </p>

      {openDispute ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-black uppercase tracking-wide text-rose-700">
              Active dispute
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-rose-700">
              {readable(openDispute.status ?? 'open')}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-rose-950/80">
            {openDispute.reason}
          </p>
          {openDispute.admin_note && (
            <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-rose-950">
              bidAI note: {openDispute.admin_note}
            </p>
          )}
        </div>
      ) : canOpenDispute ? (
        <form action={raiseDispute} className="mt-4 space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="backTo" value={backTo} />

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-black uppercase tracking-wide text-rose-800">
              Dispute category
              <select
                name="category"
                className="mt-1.5 h-10 w-full rounded-lg border border-rose-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-[#0f172a]"
                defaultValue="work_quality"
              >
                <option value="work_quality">Work quality or incomplete work</option>
                <option value="payment_release">Payment release / refund</option>
                <option value="scope_mismatch">Scope mismatch</option>
                <option value="no_show">No-show or abandonment</option>
                <option value="safety">Safety, fraud or policy concern</option>
              </select>
            </label>

            <label className="block text-xs font-black uppercase tracking-wide text-rose-800">
              Requested resolution
              <select
                name="requestedResolution"
                className="mt-1.5 h-10 w-full rounded-lg border border-rose-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-[#0f172a]"
                defaultValue={role === 'homeowner' ? 'refund_homeowner' : 'release_to_contractor'}
              >
                <option value="refund_homeowner">Refund homeowner</option>
                <option value="release_to_contractor">Release escrow to contractor</option>
                <option value="partial_refund">Partial refund / adjustment</option>
                <option value="continue_job">Continue job with admin note</option>
                <option value="other">Other resolution</option>
              </select>
            </label>
          </div>

          <label className="block text-xs font-black uppercase tracking-wide text-rose-800">
            What happened?
            <textarea
              name="reason"
              required
              rows={4}
              placeholder="Explain the issue, dates, messages, payment context and what you want reviewed."
              className="mt-1.5 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold leading-6 normal-case tracking-normal text-[#0f172a]"
            />
          </label>

          <label className="block text-xs font-black uppercase tracking-wide text-rose-800">
            Evidence summary
            <textarea
              name="evidenceSummary"
              rows={3}
              placeholder="Mention photos, messages, offer terms, invoices, site visit notes or anything bidAI should check."
              className="mt-1.5 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold leading-6 normal-case tracking-normal text-[#0f172a]"
            />
          </label>

          <button className="inline-flex h-10 items-center justify-center rounded-lg bg-rose-700 px-4 text-sm font-black text-white transition hover:bg-rose-800">
            Open formal dispute
          </button>
        </form>
      ) : (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          Formal disputes become available after payment, while escrow or job completion is at stake.
          For anything else, send a support request and the bidAI team can still review it.
        </div>
      )}

      {disputes.filter((item) => item.status === 'resolved').length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="text-xs font-black uppercase tracking-wide text-slate-500">
            Resolved dispute history
          </div>
          <div className="mt-2 space-y-2">
            {disputes
              .filter((item) => item.status === 'resolved')
              .map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-xs font-black text-[#0f172a]">
                    {readable(item.resolution ?? 'resolved')}
                  </div>
                  {item.admin_note && (
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.admin_note}</p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}

function readable(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase());
}
