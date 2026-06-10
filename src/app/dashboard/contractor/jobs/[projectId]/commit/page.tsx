import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import { commitmentFee, COMMITMENT_FEE_PCT } from '@/lib/fees';

interface Params {
  params: { projectId: string };
  searchParams?: { commit_error?: string };
}

const COMMIT_ERRORS: Record<string, string> = {
  commitment_window_expired:
    'The 48-hour commitment window expired. This job has been re-opened to other contractors.',
  not_awaiting_commitment: 'This job is no longer waiting for a commitment payment.',
  not_your_job: 'This job was awarded to a different contractor.',
  commit_update_failed: 'We could not confirm the payment. Please try again.',
  missing_service_role: 'Payment processing is not configured. Contact support.',
};

export default async function ContractorCommitPage({ params, searchParams }: Params) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'contractor') redirect('/dashboard');

  // Recover any lapsed commitment window first.
  await supabase.rpc('expire_stale_deals').then(() => undefined, () => undefined);

  const { data: project } = await supabase
    .from('projects')
    .select(`
      id,
      title,
      status,
      payment_status,
      awarded_offer_id,
      selected_offer_id,
      contractor_fee_amount,
      contractor_fee_status,
      contractor_commit_due_at,
      zip_code,
      city,
      state,
      categories(name)
    `)
    .eq('id', params.projectId)
    .maybeSingle();

  if (!project) notFound();

  const awardedOfferId = project.awarded_offer_id ?? project.selected_offer_id;

  const { data: offer } = awardedOfferId
    ? await supabase
        .from('offers')
        .select('id, amount, timeline_days, sender_id, sender_role, recipient_id, recipient_role')
        .eq('id', awardedOfferId)
        .eq('project_id', project.id)
        .maybeSingle()
    : { data: null };

  const contractorId = offer
    ? offer.sender_role === 'contractor'
      ? offer.sender_id
      : offer.recipient_id
    : null;

  if (contractorId && contractorId !== user.id) {
    redirect('/dashboard/contractor/jobs');
  }

  const errorMessage = searchParams?.commit_error
    ? COMMIT_ERRORS[searchParams.commit_error] ?? searchParams.commit_error
    : null;

  // Already claimed.
  if (project.status === 'in_progress' || project.status === 'completed') {
    return (
      <CommitShell>
        <ResultCard
          tone="success"
          title="This job is already active"
          description="You have already committed to this job. Direct chat is open and it appears in your active jobs."
          href={`/dashboard/contractor/projects/${project.id}`}
          button="Open the job"
        />
      </CommitShell>
    );
  }

  // Not in the awaiting-commitment stage.
  if (project.status !== 'paid' || project.contractor_fee_status !== 'due') {
    return (
      <CommitShell>
        <ResultCard
          tone="neutral"
          title="No commitment payment needed"
          description={
            errorMessage ??
            'This job is not currently waiting for a commitment payment. It may have been re-opened or cancelled.'
          }
          href="/dashboard/contractor/jobs"
          button="Back to jobs"
        />
      </CommitShell>
    );
  }

  const dueAt = project.contractor_commit_due_at
    ? new Date(project.contractor_commit_due_at)
    : null;
  const isExpired = dueAt ? dueAt.getTime() < Date.now() : false;

  if (isExpired) {
    return (
      <CommitShell>
        <ResultCard
          tone="warning"
          title="Commitment window expired"
          description="The 48-hour window to claim this job has passed. It has been re-opened so the homeowner can choose another contractor."
          href="/dashboard/contractor/jobs"
          button="Back to jobs"
        />
      </CommitShell>
    );
  }

  const offerAmount = Number(offer?.amount ?? 0);
  const fee =
    project.contractor_fee_amount != null
      ? Number(project.contractor_fee_amount)
      : commitmentFee(offerAmount);
  const payout = offerAmount;
  const categoryName = firstRow<any>(project.categories)?.name ?? 'Renovation';

  const hoursLeft = dueAt
    ? Math.max(0, Math.ceil((dueAt.getTime() - Date.now()) / 1000 / 60 / 60))
    : null;

  return (
    <CommitShell>
      {errorMessage && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">
              Claim this job
            </div>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
              Pay your commitment fee to start the job
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              The homeowner has paid and their funds are held in bidAI escrow.
              To lock in this job, confirm it by paying the{' '}
              {Math.round(COMMITMENT_FEE_PCT * 100)}% commitment fee. Once paid,
              the project becomes active, direct chat opens, and it moves into
              your active jobs.
            </p>

            <div className="mt-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
              <div className="text-sm font-black text-orange-900">
                Commitment window
              </div>

              <p className="mt-1 text-sm leading-6 text-orange-900/75">
                {hoursLeft != null
                  ? `You have about ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'} left to claim this job.`
                  : 'Confirm soon to secure this job.'}{' '}
                If the window closes, the job is re-opened to other contractors
                and the homeowner is refunded.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">
              Job
            </div>

            <h2 className="mt-2 text-xl font-black text-slate-900">{project.title}</h2>

            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
              <span>{categoryName}</span>
              {project.zip_code && <span>· ZIP {project.zip_code}</span>}
              {project.city && <span>· {project.city}</span>}
              {project.state && <span>{project.state}</span>}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <h3 className="text-base font-black text-emerald-900">
              What you receive after the job
            </h3>

            <p className="mt-2 text-sm leading-6 text-emerald-900/75">
              The full project amount of {formatCurrency(offerAmount)} is held in
              escrow. After you complete the work and the homeowner marks it complete,
the full project amount of {formatCurrency(payout)} is released to you.
Your commitment fee of {formatCurrency(fee)} is paid separately to confirm
the job and is not deducted from your project payout.
            </p>
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Commitment summary
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <SummaryRow label="Project amount (in escrow)" value={formatCurrency(offerAmount)} />
            {offer?.timeline_days ? (
              <SummaryRow label="Timeline" value={`${offer.timeline_days} days`} />
            ) : null}
            <SummaryRow
              label={`Commitment fee (${Math.round(COMMITMENT_FEE_PCT * 100)}%)`}
              value={formatCurrency(fee)}
              helper="Charged now to confirm the job."
            />
            <SummaryRow label="Your escrow payout after completion" value={formatCurrency(payout)} />

            <div className="my-4 h-px bg-slate-200" />

            <div className="flex items-center justify-between gap-3">
              <span className="text-base font-black text-slate-900">Due now</span>
              <span className="text-2xl font-black tracking-tight text-slate-900">
                {formatCurrency(fee)}
              </span>
            </div>
          </div>

          <form action={`/api/contractor/commit/${project.id}`} method="POST" className="mt-5">
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#f45112] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#d94406]"
            >
              Pay {formatCurrency(fee)} &amp; claim job
            </button>
          </form>

          <Link
            href="/dashboard/contractor/jobs"
            className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:bg-slate-50"
          >
            Decide later
          </Link>

          <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
            Test mode: paying the commitment fee activates the job and unlocks
            direct chat with the homeowner.
          </p>
        </aside>
      </div>
    </CommitShell>
  );
}

function CommitShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f8fb] px-5 py-8 text-slate-900 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/dashboard/contractor/jobs"
          className="mb-6 inline-flex text-sm font-black text-slate-500 hover:text-slate-900"
        >
          ← Back to active jobs
        </Link>
        {children}
      </div>
    </main>
  );
}

function SummaryRow({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="py-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-sm font-bold text-slate-600">{label}</span>
          {helper && <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{helper}</p>}
        </div>
        <span className="text-sm font-black text-slate-900">{value}</span>
      </div>
    </div>
  );
}

function ResultCard({
  tone,
  title,
  description,
  href,
  button,
}: {
  tone: 'success' | 'warning' | 'neutral';
  title: string;
  description: string;
  href: string;
  button: string;
}) {
  const palette = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-orange-200 bg-orange-50 text-orange-900',
    neutral: 'border-slate-200 bg-white text-slate-900',
  }[tone];

  return (
    <div className={`rounded-3xl border p-8 text-center shadow-sm ${palette}`}>
      <h1 className="text-2xl font-black">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 opacity-80">{description}</p>
      <Link
        href={href}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#f45112] px-5 text-sm font-black text-white hover:bg-[#d94406]"
      >
        {button}
      </Link>
    </div>
  );
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}
