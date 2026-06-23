export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import { DashboardSidebar } from '@/components/DashboardSidebar';

interface Params {
  params: {
    projectId: string;
  };
}

const DEFAULT_PROTECTION_HOLD_AMOUNT = 300;

export default async function ProjectCheckoutPage({ params }: Params) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Recover any stale payment / commitment reservation first so checkout
  // never gets stuck on an expired window.
  await supabase.rpc('expire_stale_deals').then(() => undefined, () => undefined);

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select(`
      id,
      title,
      homeowner_id,
      status,
      payment_status,
      payment_due_at,
      selected_offer_id,
      awarded_offer_id,
      protection_hold_amount,
      protection_hold_status,
      zip_code,
      categories(name)
    `)
    .eq('id', params.projectId)
    .maybeSingle();

  if (projectError) {
    console.error('Checkout project query error:', projectError);
    return (
      <CheckoutShell backHref="/dashboard/homeowner">
        <UnavailableCard
          title="Checkout could not load"
          description="We hit a problem loading this checkout. Please head back to the project and open checkout again."
          href="/dashboard/homeowner"
          button="Back to dashboard"
        />
      </CheckoutShell>
    );
  }

  if (!project) notFound();

  if (project.homeowner_id !== user.id) {
    redirect('/dashboard');
  }

  const selectedOfferId =
    project.selected_offer_id ?? project.awarded_offer_id ?? null;

  const isPayable =
    (project.status === 'pending_payment' &&
      project.payment_status === 'pending') ||
    project.status === 'awarded';

  if (!isPayable) {
    return (
      <CheckoutShell backHref={`/dashboard/homeowner/projects/${project.id}`}>
        <UnavailableCard
          title="Checkout is not available"
          description="This project is not currently waiting for payment. The offer may have expired, been cancelled, or already paid."
          href={`/dashboard/homeowner/projects/${project.id}`}
          button="Back to project"
        />
      </CheckoutShell>
    );
  }

  if (!selectedOfferId) {
    return (
      <CheckoutShell backHref={`/dashboard/homeowner/projects/${project.id}`}>
        <UnavailableCard
          title="No selected offer found"
          description="This checkout could not find the accepted offer. Please return to the project and continue negotiation."
          href={`/dashboard/homeowner/projects/${project.id}`}
          button="Back to project"
        />
      </CheckoutShell>
    );
  }

  const dueAt = project.payment_due_at ? new Date(project.payment_due_at) : null;

  const isExpired = dueAt ? dueAt.getTime() < Date.now() : false;

  if (isExpired) {
    return (
      <CheckoutShell backHref={`/dashboard/homeowner/projects/${project.id}`}>
        <div className="rounded-3xl border border-orange-200 bg-orange-50 p-8 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-orange-100 text-orange-700">
            ⏱
          </div>

          <h1 className="mt-4 text-2xl font-black text-orange-900">
            Payment window expired
          </h1>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-orange-900/75">
            This offer was reserved for payment, but the payment window has
            expired. Return to the project and continue negotiation with a fresh
            offer.
          </p>

          <Link
            href={`/dashboard/homeowner/projects/${project.id}`}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-orange-600 px-5 text-sm font-black text-white hover:bg-orange-700"
          >
            Back to project
          </Link>
        </div>
      </CheckoutShell>
    );
  }

  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .select(`
      id,
      project_id,
      conversation_id,
      sender_id,
      sender_role,
      recipient_id,
      recipient_role,
      kind,
      amount,
      timeline_days,
      status,
      scope_summary,
      included_items,
      excluded_items,
      notes,
      message,
      contractor_fee_amount,
      contractor_fee_status,
      created_at
    `)
    .eq('id', selectedOfferId)
    .eq('project_id', project.id)
    .maybeSingle();

  if (offerError) {
    console.error('Checkout offer query error:', offerError);
    return (
      <CheckoutShell backHref={`/dashboard/homeowner/projects/${project.id}`}>
        <UnavailableCard
          title="Checkout could not load"
          description="We hit a problem loading the accepted offer for this checkout. Please return to the project and try again."
          href={`/dashboard/homeowner/projects/${project.id}`}
          button="Back to project"
        />
      </CheckoutShell>
    );
  }

  if (!offer) {
    return (
      <CheckoutShell backHref={`/dashboard/homeowner/projects/${project.id}`}>
        <UnavailableCard
          title="Accepted offer not found"
          description="The offer associated with this checkout could not be found. It may have been replaced or removed."
          href={`/dashboard/homeowner/projects/${project.id}`}
          button="Back to project"
        />
      </CheckoutShell>
    );
  }

  if (!['payment_pending', 'accepted'].includes(offer.status)) {
    return (
      <CheckoutShell backHref={`/dashboard/homeowner/projects/${project.id}`}>
        <UnavailableCard
          title="This offer is not ready for checkout"
          description="Only an accepted offer with pending payment can be checked out."
          href={`/dashboard/homeowner/projects/${project.id}`}
          button="Back to project"
        />
      </CheckoutShell>
    );
  }

  const contractorId =
    offer.sender_role === 'contractor' ? offer.sender_id : offer.recipient_id;

  const contractorName = await getContractorName(supabase, contractorId);

  const protectionHoldAmount =
    project.protection_hold_amount !== null &&
    project.protection_hold_amount !== undefined
      ? Number(project.protection_hold_amount)
      : DEFAULT_PROTECTION_HOLD_AMOUNT;

  const offerAmount = Number(offer.amount);
  const totalDueToday = offerAmount + protectionHoldAmount;

  const minutesLeft = dueAt
    ? Math.max(0, Math.ceil((dueAt.getTime() - Date.now()) / 1000 / 60))
    : null;

  const scopeText = buildScopeText(offer);

  return (
    <CheckoutShell backHref={`/dashboard/homeowner/projects/${project.id}`}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">
              Secure checkout
            </div>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
              Complete payment to book this contractor
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Your payment is held safely in bidAI escrow. The contractor then
              has 48 hours to confirm the job by paying their commitment fee.
              Direct chat opens once the contractor commits - and if they don&apos;t,
              you are refunded in full and can pick another contractor.
            </p>

            <div className="mt-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
              <div className="text-sm font-black text-orange-900">
                Payment window
              </div>

              <p className="mt-1 text-sm leading-6 text-orange-900/75">
                {minutesLeft !== null
                  ? `You have about ${minutesLeft} minute${
                      minutesLeft === 1 ? '' : 's'
                    } left to complete payment.`
                  : 'Complete payment to secure this contractor.'}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">
              Selected project
            </div>

            <h2 className="mt-2 text-xl font-black text-slate-900">
              {project.title}
            </h2>

            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
              {project.zip_code && <span>ZIP {project.zip_code}</span>}
              <span>{firstRow<any>(project.categories)?.name ?? 'Renovation'}</span>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm">
                <ShieldIcon />
              </div>

              <div>
                <h3 className="text-base font-black text-emerald-900">
                  bidAI payment protection
                </h3>

                <p className="mt-2 text-sm leading-6 text-emerald-900/75">
                  Your project payment and protection hold stay inside bidAI.
                  Funds are released according to completion and dispute rules.
                  The {formatCurrency(protectionHoldAmount)} protection hold
                  helps protect both sides if the project does not start,
                  is abandoned, or enters dispute review.
                </p>

                <p className="mt-2 text-xs font-bold leading-5 text-emerald-900/70">
                  All communication and payment must stay inside bidAI. Direct
                  chat unlocks only after checkout.
                </p>
              </div>
            </div>
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Payment summary
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <SummaryRow
              label="Accepted offer"
              value={formatCurrency(offerAmount)}
            />

            <SummaryRow
              label="bidAI protection hold"
              value={formatCurrency(protectionHoldAmount)}
              helper="Held for project protection and dispute coverage."
            />

            {offer.timeline_days && (
              <SummaryRow
                label="Timeline"
                value={`${offer.timeline_days} days`}
              />
            )}

            <SummaryRow
              label="Contractor"
              value={contractorName}
            />

            <div className="my-4 h-px bg-slate-200" />

            <div className="flex items-center justify-between gap-3">
              <span className="text-base font-black text-slate-900">
                Total due today
              </span>

              <span className="text-2xl font-black tracking-tight text-slate-900">
                {formatCurrency(totalDueToday)}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm">
                <ShieldIcon />
              </div>

              <div>
                <div className="text-xs font-black uppercase tracking-wide text-emerald-800">
                  About the protection hold
                </div>

                <p className="mt-2 text-xs leading-5 text-emerald-900/80">
                  The protection hold helps keep the project secure after you
                  accept an offer. It gives bidAI room to review issues if the
                  contractor does not start, abandons the project, or if the job
                  enters a dispute.
                </p>
              </div>
            </div>
          </div>

          {scopeText && (
            <div className="mt-4 rounded-lg border border-slate-200 p-4">
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                Scope note
              </div>

              <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {scopeText}
              </p>
            </div>
          )}

          <form
            action={`/api/checkout/project/${project.id}`}
            method="POST"
            className="mt-5"
          >
            <input type="hidden" name="offerId" value={offer.id} />

            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#f45112] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#d94406]"
            >
              Pay {formatCurrency(totalDueToday)}
            </button>
          </form>

          <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
            Test mode: payment confirmation holds your funds in escrow and asks
            the contractor to confirm the job by paying their commitment fee.
          </p>
        </aside>
      </div>
    </CheckoutShell>
  );
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

async function getContractorName(supabase: any, contractorId: string | null) {
  if (!contractorId) return 'Contractor';

  const { data: contractorProfile } = await supabase
    .from('contractor_profiles')
    .select('company_name')
    .eq('user_id', contractorId)
    .maybeSingle();

  if (contractorProfile?.company_name) {
    return contractorProfile.company_name;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', contractorId)
    .maybeSingle();

  return profile?.full_name ?? 'Contractor';
}

function buildScopeText(offer: any): string | null {
  const included = normalizeItems(offer.included_items);
  const excluded = normalizeItems(offer.excluded_items);
  const notes = normalizeItems(offer.notes);

  const lines = [
    offer.scope_summary || null,
    included.length ? 'Included:' : null,
    ...included.map((item) => `- ${item}`),
    excluded.length ? '' : null,
    excluded.length ? 'Excluded:' : null,
    ...excluded.map((item) => `- ${item}`),
    notes.length ? '' : null,
    notes.length ? 'Notes:' : null,
    ...notes.map((item) => `- ${item}`),
    offer.message && !looksLikeJson(offer.message) ? '' : null,
    offer.message && !looksLikeJson(offer.message) ? offer.message : null,
  ].filter(Boolean);

  return lines.length ? lines.join('\n') : null;
}

function normalizeItems(value: string[] | string | null | undefined): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value)
    .split(/\n|,|;|•/)
    .map((item) => item.replace(/^[-–—]\s*/, '').trim())
    .filter(Boolean);
}

function looksLikeJson(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function CheckoutShell({
  children,
  backHref,
}: {
  children: React.ReactNode;
  backHref: string;
}) {
  return (
    <div className="flex min-h-screen bg-[#f6f8fb] text-slate-900">
      <DashboardSidebar role="homeowner" active="compare" />

      <main className="min-w-0 flex-1 px-5 py-8 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href={backHref}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-black text-slate-500 hover:text-slate-900"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to project
          </Link>

          {children}
        </div>
      </main>
    </div>
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
          <span className="text-sm font-bold text-slate-600">
            {label}
          </span>

          {helper && (
            <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
              {helper}
            </p>
          )}
        </div>

        <span className="text-sm font-black text-slate-900">
          {value}
        </span>
      </div>
    </div>
  );
}

function UnavailableCard({
  title,
  description,
  href,
  button,
}: {
  title: string;
  description: string;
  href: string;
  button: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-slate-100 text-slate-500">
        !
      </div>

      <h1 className="mt-4 text-2xl font-black text-slate-900">
        {title}
      </h1>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>

      <Link
        href={href}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#f45112] px-5 text-sm font-black text-white hover:bg-[#d94406]"
      >
        {button}
      </Link>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
     
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
