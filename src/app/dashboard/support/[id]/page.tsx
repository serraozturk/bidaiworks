import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import ReplyForm from './reply-form';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
  searchParams?: { sent?: string; error?: string };
}

function readable(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
}

function formatWhen(value: string | null | undefined) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

export default async function SupportCaseDetailPage({
  params,
  searchParams,
}: Params) {
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

  const { data: report } = await supabase
    .from('support_reports')
    .select(
      `
      id, reporter_id, category, priority, subject, message, status,
      admin_note, requested_outcome, contact_preference, project_id,
      created_at, resolved_at
    `,
    )
    .eq('id', params.id)
    .eq('reporter_id', user.id)
    .maybeSingle();

  if (!report) notFound();

  const { data: messages } = await supabase
    .from('support_messages')
    .select('id, sender_role, body, created_at')
    .eq('report_id', report.id)
    .order('created_at', { ascending: true });

  const thread = messages ?? [];
  const isResolved = report.status === 'resolved';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <DashboardSidebar role={role} active="support" />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[860px] px-5 py-6">
            <Link
              href="/dashboard/support"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              ← All support cases
            </Link>

            <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Case #{String(report.id).slice(0, 8)}
                </div>
                <h1 className="mt-0.5 text-xl font-black tracking-tight text-slate-900">
                  {report.subject}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge value={report.status ?? 'awaiting_admin'} />
                  <Badge>{readable(report.category ?? 'general')}</Badge>
                  <Badge>{readable(report.priority ?? 'normal')} priority</Badge>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Opened {formatWhen(report.created_at)}
                  </span>
                </div>
              </div>

              {searchParams?.sent === '1' && (
                <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-2.5 text-xs font-bold text-emerald-800">
                  Your message was added to the case and the bidAI team has
                  been notified.
                </div>
              )}
              {searchParams?.error && (
                <div className="border-b border-red-200 bg-red-50 px-5 py-2.5 text-xs font-bold text-red-700">
                  {searchParams.error === 'missing'
                    ? 'Please add a message before sending.'
                    : 'Could not send your reply. Please try again.'}
                </div>
              )}

              <div className="divide-y divide-slate-100">
                <ThreadBubble
                  tone="reporter"
                  who={profile?.full_name || 'You'}
                  when={formatWhen(report.created_at)}
                  body={report.message || ''}
                  label="Your initial report"
                />

                {thread.map((m) => (
                  <ThreadBubble
                    key={m.id}
                    tone={m.sender_role === 'admin' ? 'admin' : 'reporter'}
                    who={
                      m.sender_role === 'admin'
                        ? 'bidAI support'
                        : profile?.full_name || 'You'
                    }
                    when={formatWhen(m.created_at)}
                    body={m.body}
                  />
                ))}

                {isResolved && (
                  <div className="bg-emerald-50/50 px-5 py-4">
                    <div className="text-xs font-black uppercase tracking-wide text-emerald-700">
                      This case has been resolved
                    </div>
                    <div className="mt-0.5 text-xs text-emerald-800">
                      Closed {formatWhen(report.resolved_at)}.
                    </div>
                    {report.admin_note && (
                      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                        <span className="font-black text-emerald-700">
                          Resolution from bidAI:{' '}
                        </span>
                        {report.admin_note}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-slate-500">
                      Need to follow up on something new?{' '}
                      <Link
                        href="/dashboard/support"
                        className="font-black text-[#f45112] hover:underline"
                      >
                        Open a fresh support case →
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            </section>

            {!isResolved && (
              <ReplyForm reportId={report.id} />
            )}

            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
              Keep all messages inside bidAI so the team has the full
              context. Do not share phone numbers, emails, or external
              payment details — they make it harder to help you.
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    awaiting_admin: {
      label: 'bidAI is reviewing',
      cls: 'bg-amber-100 text-amber-800',
    },
    awaiting_reporter: {
      label: 'Waiting on you',
      cls: 'bg-sky-100 text-sky-800',
    },
    open: { label: 'bidAI is reviewing', cls: 'bg-amber-100 text-amber-800' },
    resolved: { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-800' },
  };
  const found = map[value] ?? { label: value, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${found.cls}`}
    >
      {found.label}
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase text-slate-600">
      {children}
    </span>
  );
}

function ThreadBubble({
  tone,
  who,
  when,
  body,
  label,
}: {
  tone: 'reporter' | 'admin';
  who: string;
  when: string;
  body: string;
  label?: string;
}) {
  const isAdmin = tone === 'admin';
  return (
    <div className={isAdmin ? 'bg-orange-50/40 px-5 py-4' : 'bg-white px-5 py-4'}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={[
            'inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-black uppercase tracking-wide',
            isAdmin
              ? 'bg-orange-600 text-white'
              : 'bg-slate-900 text-white',
          ].join(' ')}
        >
          {isAdmin ? 'bidAI support' : 'You'}
        </span>
        <span className="text-sm font-bold text-slate-700">{who}</span>
        <span className="text-[11px] font-semibold text-slate-400">{when}</span>
        {label && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-800">
            {label}
          </span>
        )}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
        {body}
      </p>
    </div>
  );
}
