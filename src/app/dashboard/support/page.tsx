import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { submitSupportReport } from '@/app/dashboard/actions';

export const dynamic = 'force-dynamic';

const CATEGORIES = [
  { value: 'payment', label: 'Payment or escrow' },
  { value: 'contractor', label: 'A contractor' },
  { value: 'homeowner', label: 'A homeowner' },
  { value: 'project', label: 'A project or offer' },
  { value: 'account', label: 'My account' },
  { value: 'technical', label: 'Something is broken' },
  { value: 'safety', label: 'Safety, fraud or policy concern' },
  { value: 'other', label: 'Something else' },
];

interface Params {
  searchParams?: {
    sent?: string;
    error?: string;
    projectId?: string;
  };
}

export default async function SupportPage({ searchParams }: Params) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  const role = (profile?.role as 'homeowner' | 'contractor') ?? 'homeowner';

  const [{ data: reports }, { data: disputes }] = await Promise.all([
    supabase
      .from('support_reports')
      .select(
        `
        id,
        category,
        subject,
        message,
        status,
        priority,
        requested_outcome,
        contact_preference,
        admin_note,
        created_at,
        resolved_at
      `,
      )
      .eq('reporter_id', user.id)
      .order('created_at', { ascending: false }),

    supabase
      .from('disputes')
      .select(
        `
        id,
        project_id,
        category,
        priority,
        requested_resolution,
        reason,
        status,
        resolution,
        admin_note,
        created_at,
        resolved_at
      `,
      )
      .order('created_at', { ascending: false }),
  ]);

  const supportRows = reports ?? [];
  const disputeRows = disputes ?? [];

  const openReports = supportRows.filter((item) => item.status !== 'resolved');
  const resolvedReports = supportRows.filter(
    (item) => item.status === 'resolved',
  );

  const openDisputes = disputeRows.filter((item) => item.status !== 'resolved');

  const sent = searchParams?.sent === '1';
  const error = searchParams?.error;
  const projectId = searchParams?.projectId ?? '';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="flex min-h-screen">
        <DashboardSidebar role={role} active="support" />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1180px] px-5 py-6">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="px-6 py-6">
                <div className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-orange-600">
                  Help & support
                </div>

                <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-950">
                      Support case center
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Create a support case when you need help with payments,
                      escrow, users, offers, messages, projects or account
                      problems. You can follow all your cases from this page.
                    </p>
                  </div>

                  <a
                    href="#new-case"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-[#061b3a] px-4 text-sm font-black text-white transition hover:bg-[#f45112]"
                  >
                    Open new case
                  </a>
                </div>
              </div>

              <div className="grid border-t border-slate-100 md:grid-cols-4">
                <SupportMetric label="Open support" value={openReports.length} />
                <SupportMetric
                  label="Resolved support"
                  value={resolvedReports.length}
                  tone="success"
                />
                <SupportMetric
                  label="Open disputes"
                  value={openDisputes.length}
                  tone="danger"
                />
                <SupportMetric
                  label="Total cases"
                  value={supportRows.length + disputeRows.length}
                />
              </div>
            </section>

            {sent && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                Your support case was sent successfully. The bidAI support team
                can now review it.
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error === 'missing'
                  ? 'Please add a subject and a description.'
                  : 'Something went wrong while sending your case. Please try again.'}
              </div>
            )}

            <form
              id="new-case"
              action={submitSupportReport}
              className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-orange-600">
                    New support case
                  </div>

                  <h2 className="mt-1 text-lg font-black text-slate-950">
                    Tell us what happened
                  </h2>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Add enough context so support can understand the problem:
                    project, payment, offer, message, user behavior, account or
                    technical issue.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                  Visible to bidAI admin
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  What is this about?
                  <select
                    name="category"
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none normal-case tracking-normal transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                    defaultValue="other"
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Priority
                  <select
                    name="priority"
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none normal-case tracking-normal transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                    defaultValue="normal"
                  >
                    <option value="low">Low - question or suggestion</option>
                    <option value="normal">Normal - needs support</option>
                    <option value="high">
                      High - blocking project progress
                    </option>
                    <option value="urgent">
                      Urgent - payment, safety or fraud risk
                    </option>
                  </select>
                </label>
              </div>

              <label className="mt-4 block text-xs font-black uppercase tracking-wide text-slate-500">
                Subject
                <input
                  name="subject"
                  required
                  maxLength={140}
                  placeholder="Example: I have a problem with my payment"
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none normal-case tracking-normal transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <label className="mt-4 block text-xs font-black uppercase tracking-wide text-slate-500">
                Description
                <textarea
                  name="message"
                  required
                  rows={6}
                  placeholder="Describe the issue clearly. Include names, project details, payment details or message context if relevant."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold leading-6 text-slate-900 outline-none normal-case tracking-normal transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Related project ID
                  <input
                    name="projectId"
                    defaultValue={projectId}
                    placeholder="Optional"
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none normal-case tracking-normal transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                </label>

                <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Contact preference
                  <select
                    name="contactPreference"
                    defaultValue="in_app"
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none normal-case tracking-normal transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  >
                    <option value="in_app">In-app support note</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone if needed</option>
                  </select>
                </label>
              </div>

              <label className="mt-4 block text-xs font-black uppercase tracking-wide text-slate-500">
                What outcome do you want?
                <textarea
                  name="requestedOutcome"
                  rows={3}
                  placeholder="Example: I want the payment reviewed, the project checked, or the user investigated."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold leading-6 text-slate-900 outline-none normal-case tracking-normal transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[#061b3a] px-5 text-sm font-black text-white transition hover:bg-[#f45112]"
                >
                  Send support case
                </button>

                <p className="text-xs font-semibold text-slate-500">
                  After sending, your case will appear below.
                </p>
              </div>
            </form>

            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              <CaseList
                title="Your support cases"
                description="Cases you sent directly to bidAI support."
                rows={supportRows}
                type="support"
              />

              <CaseList
                title="Your formal disputes"
                description="Disputes connected to paid projects or escrow review."
                rows={disputeRows}
                type="dispute"
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SupportMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'danger';
}) {
  const color =
    tone === 'success'
      ? 'text-emerald-600'
      : tone === 'danger'
        ? 'text-rose-600'
        : 'text-slate-950';

  return (
    <div className="border-b border-slate-100 px-5 py-4 md:border-b-0 md:border-r md:last:border-r-0">
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      <div className="mt-1 text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}

function CaseList({
  title,
  description,
  rows,
  type,
}: {
  title: string;
  description: string;
  rows: any[];
  type: 'support' | 'dispute';
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-black text-slate-950">{title}</h2>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          {description}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">
          {type === 'support'
            ? "You haven't opened a support case yet."
            : 'No formal disputes yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((item) => {
            const isResolved = item.status === 'resolved';

            return (
              <li key={item.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {(() => {
                        const status = String(item.status ?? 'open');
                        const label =
                          status === 'resolved'
                            ? 'Resolved'
                            : type === 'support' && status === 'awaiting_reporter'
                              ? 'Waiting on you'
                              : type === 'support'
                                ? 'bidAI is reviewing'
                                : 'Open';
                        const cls =
                          status === 'resolved'
                            ? 'bg-emerald-50 text-emerald-700'
                            : status === 'awaiting_reporter'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-amber-50 text-amber-700';
                        return (
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-black ${cls}`}
                          >
                            {label}
                          </span>
                        );
                      })()}

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                        {type === 'support'
                          ? readableStatus(item.category ?? 'support')
                          : readableStatus(item.category ?? 'dispute')}
                      </span>

                      {item.priority && (
                        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-black text-orange-700">
                          {readableStatus(item.priority)}
                        </span>
                      )}
                    </div>

                    {type === 'support' ? (
                      <Link
                        href={`/dashboard/support/${item.id}`}
                        className="mt-2 block text-sm font-black text-slate-950 hover:text-[#f45112]"
                      >
                        {item.subject || 'Support request'}
                      </Link>
                    ) : (
                      <h3 className="mt-2 text-sm font-black text-slate-950">
                        {readableStatus(item.category ?? 'Formal dispute')}
                      </h3>
                    )}
                  </div>

                  <div className="text-right text-[11px] font-bold text-slate-400">
                    <div>{formatDate(item.created_at)}</div>
                    <div className="mt-1">Case #{String(item.id).slice(0, 8)}</div>
                  </div>
                </div>

                {item.requested_outcome && (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Requested outcome: {item.requested_outcome}
                  </p>
                )}

                {item.requested_resolution && (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Requested resolution:{' '}
                    {readableStatus(item.requested_resolution)}
                  </p>
                )}

                <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                  {type === 'support'
                    ? item.message || 'No message.'
                    : item.reason || 'No dispute reason.'}
                </p>

                {item.admin_note ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-900">
                    <div className="text-xs font-black uppercase tracking-wide text-emerald-700">
                      bidAI team response
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{item.admin_note}</p>
                  </div>
                ) : (
                  !isResolved && (
                    <p className="mt-3 text-xs font-semibold text-slate-400">
                      Waiting for bidAI support response.
                    </p>
                  )
                )}

                {item.resolved_at && (
                  <p className="mt-3 text-xs font-semibold text-slate-400">
                    Resolved {formatDate(item.resolved_at)}
                  </p>
                )}

                {type === 'support' && (
                  <div className="mt-4 flex justify-end">
                    <Link
                      href={`/dashboard/support/${item.id}`}
                      className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 hover:text-[#f45112]"
                    >
                      Open case →
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function readableStatus(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return '';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}