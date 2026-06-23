'use client';

import { useState } from 'react';
import type React from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { COMMITMENT_FEE_PCT, commitmentFee } from '@/lib/fees';
import { MakeOfferButton } from '@/components/MakeOfferButton';

interface DealPanelProps {
  role: 'homeowner' | 'contractor';
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  zipCode: string | null;
  category: string | null;

  /**
   * Offers-centered model.
   *
   * awardedOfferId:
   * The final accepted/awarded offer for this project.
   *
   * selectedOfferId:
   * Optional temporary selected offer while moving toward checkout.
   */
  awardedOfferId?: string | null;
  selectedOfferId?: string | null;

  /**
   * Legacy fields can stay temporarily during migration.
   * DealPanel no longer uses quote logic.
   */
  awardedQuoteId?: string | null;
  quote?: {
    id: string;
    amount: number;
    timeline_days: number | null;
    status: string;
  } | null;

  partnerId: string;
  partnerName: string;

  /**
   * Contractor contact info — only populated for homeowners when project is
   * in_progress or completed. Kept null/undefined at all other times.
   */
  contractorContact?: {
    phone?: string | null;
    website?: string | null;
    address_line?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  } | null;

  /**
   * Contractor public profile — always passed to homeowners so they can
   * review the contractor before and during negotiation.
   */
  contractorProfileCard?: {
    companyName: string | null;
    bio: string | null;
    ratingAvg: number | null;
    ratingCount: number;
    completedJobsCount: number;
    yearsInBusiness: number | null;
    verified: boolean;
    reviews: Array<{ rating: number; comment: string | null; created_at: string }>;
  } | null;

  offers: Array<{
    id: string;
    amount: number;
    timeline_days: number | null;
    status: string;
    sender_role: 'homeowner' | 'contractor';
    recipient_role?: 'homeowner' | 'contractor' | null;
    kind?: string | null;
    scope_summary?: string | null;
    included_items?: string[] | string | null;
    excluded_items?: string[] | string | null;
    notes?: string[] | string | null;
    message?: string | null;
    created_at?: string | null;
  }>;
}

/**
 * Direct chat is unlocked by project status, not by offer status.
 *
 * Chat opens only once the contractor has paid the commitment fee and the
 * project is `in_progress`. While the project is `paid` (homeowner paid,
 * contractor has not committed yet) chat stays locked.
 *
 * - offers.status controls negotiation state.
 * - projects.status controls project/payment/job lifecycle.
 */
const CHAT_UNLOCKED_STATUSES = ['in_progress', 'completed'];

const NEGOTIATION_PROJECT_STATUSES = [
  'open',
  'in_review',
  'quoted', // legacy support
  'negotiating',
];

const primaryBtn =
  'inline-flex h-9 w-full items-center justify-center rounded-lg bg-[#f45112] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#d94406]';

const secondaryBtn =
  'inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50';

function readableStatus(value: string): string {
  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function DealPanel({
  role,
  projectId,
  projectTitle,
  projectStatus,
  zipCode,
  category,
  awardedOfferId,
  selectedOfferId,
  partnerId,
  partnerName,
  contractorContact,
  contractorProfileCard,
  offers,
}: DealPanelProps) {
  const normalizedStatus = projectStatus || 'open';

  const sortedOffers = [...offers].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;

    return bTime - aTime;
  });

  const latestOffer = sortedOffers[0] ?? null;

  const awardedOffer = awardedOfferId
    ? sortedOffers.find((offer) => offer.id === awardedOfferId) ?? null
    : null;

  const selectedOffer = selectedOfferId
    ? sortedOffers.find((offer) => offer.id === selectedOfferId) ?? null
    : null;

  const pendingOffer =
    sortedOffers.find((offer) => offer.status === 'pending') ?? null;

  /**
   * Preferred long-term model:
   * - accepted offer remains offers.status = accepted
   * - project.status becomes pending_payment / paid / in_progress / completed
   *
   * Legacy support:
   * Some older records may have offer.status = payment_pending or paid.
   */
  const acceptedOffer =
    awardedOffer ??
    selectedOffer ??
    sortedOffers.find((offer) => offer.status === 'accepted') ??
    sortedOffers.find((offer) => offer.status === 'payment_pending') ??
    sortedOffers.find((offer) => offer.status === 'paid') ??
    null;

  const expiredOffer =
    sortedOffers.find((offer) => offer.status === 'expired') ?? null;

  const isPendingPayment =
    normalizedStatus === 'pending_payment' || normalizedStatus === 'awarded';
  const isPaid = normalizedStatus === 'paid';
  const isInProgress = normalizedStatus === 'in_progress';
  const isCompleted = normalizedStatus === 'completed';
  const isCancelled = normalizedStatus === 'cancelled';

  const isActiveJob = isPaid || isInProgress;
  const isClosed = isCompleted || isCancelled;

  /**
   * Do not depend on project.status = expired.
   * Expiration belongs to offers, not projects.
   */
  const hasExpiredDeal = Boolean(
    expiredOffer &&
      !pendingOffer &&
      !acceptedOffer &&
      !isPendingPayment &&
      !isActiveJob &&
      !isCompleted &&
      !isCancelled,
  );

  const isNegotiating =
    !hasExpiredDeal &&
    !isPendingPayment &&
    !isActiveJob &&
    !isClosed &&
    NEGOTIATION_PROJECT_STATUSES.includes(normalizedStatus);

  const isChatUnlocked = CHAT_UNLOCKED_STATUSES.includes(normalizedStatus);

  // The focus is the offer (not the finished project) while negotiating,
  // waiting on payment, or after an offer expired - rename the CTA so it
  // matches what the person is actually about to look at.
  const hasActiveOffer = isNegotiating || isPendingPayment || hasExpiredDeal;

  const displayOffer =
    acceptedOffer ??
    pendingOffer ??
    findLatestReusableOffer(sortedOffers) ??
    latestOffer;

  const activeAmount = Number(displayOffer?.amount ?? 0);
  const activeTimeline = displayOffer?.timeline_days ?? null;

  const messagesHref = `/dashboard/messages/${projectId}/${partnerId}`;

  const projectHref =
    role === 'homeowner'
      ? `/dashboard/homeowner/projects/${projectId}?returnTo=${encodeURIComponent(
          messagesHref,
        )}`
      : `/dashboard/contractor/projects/${projectId}?returnTo=${encodeURIComponent(
          messagesHref,
        )}`;

  /**
   * Checkout should be project-based or accepted-offer based.
   * This keeps the route stable even if the accepted offer changes during migration.
   */
  const checkoutHref = `/dashboard/checkout/project/${projectId}`;

  const visiblePartnerName = isChatUnlocked
    ? partnerName
    : role === 'homeowner'
      ? 'Contractor hidden until checkout'
      : 'Homeowner hidden until checkout';

  return (
    <aside className="space-y-2.5 lg:h-full lg:overflow-y-auto lg:pr-1">
      <OverviewCard
        title={projectTitle}
        category={category}
        zip={zipCode}
        partnerName={visiblePartnerName}
        chatUnlocked={isChatUnlocked}
        status={normalizedStatus}
        projectHref={projectHref}
        hasActiveOffer={hasActiveOffer}
        contractorContact={role === 'homeowner' ? contractorContact : null}
        role={role}
        partnerId={partnerId}
        messagesHref={messagesHref}
      />

      {!isChatUnlocked && !isCancelled && (
        <MarketplaceRuleCard
          role={role}
          projectStatus={normalizedStatus}
          amount={activeAmount}
        />
      )}

      <NextStepCard
        role={role}
        projectId={projectId}
        projectTitle={projectTitle}
        projectHref={projectHref}
        checkoutHref={checkoutHref}
        partnerId={partnerId}
        partnerName={partnerName}
        latestOffer={latestOffer}
        pendingOffer={pendingOffer}
        acceptedOffer={acceptedOffer}
        expiredOffer={expiredOffer}
        sortedOffers={sortedOffers}
        hasExpiredDeal={hasExpiredDeal}
        isNegotiating={isNegotiating}
        isPendingPayment={isPendingPayment}
        isActiveJob={isActiveJob}
        isPaid={isPaid}
        isInProgress={isInProgress}
        isCompleted={isCompleted}
        isCancelled={isCancelled}
        activeAmount={activeAmount}
        activeTimeline={activeTimeline}
      />

    </aside>
  );
}

function ContractorProfileCard({
  profile,
}: {
  profile: NonNullable<DealPanelProps['contractorProfileCard']>;
}) {
  const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
            {(profile.companyName ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-black text-slate-900">
                {profile.companyName ?? 'Contractor'}
              </span>
              {profile.verified && (
                <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                  ✓ Verified
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 px-2 py-2">
            <div className="text-base font-black text-slate-900">{profile.completedJobsCount}</div>
            <div className="text-[10px] font-semibold text-slate-500">Jobs done</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-2 py-2">
            <div className="text-base font-black text-slate-900">
              {profile.ratingAvg !== null ? profile.ratingAvg.toFixed(1) : '—'}
            </div>
            <div className="text-[10px] font-semibold text-slate-500">
              {profile.ratingCount > 0 ? `${profile.ratingCount} reviews` : 'No reviews'}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 px-2 py-2">
            <div className="text-base font-black text-slate-900">
              {profile.yearsInBusiness !== null ? `${profile.yearsInBusiness}y` : '—'}
            </div>
            <div className="text-[10px] font-semibold text-slate-500">Experience</div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-xs leading-relaxed text-slate-600">{profile.bio}</p>
        )}

        {/* Reviews */}
        {profile.reviews.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
              Recent reviews
            </div>
            {profile.reviews.slice(0, 3).map((r, i) => (
              <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-500">{stars(r.rating)}</span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {r.comment && (
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600 line-clamp-2">
                    {r.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NextStepCard({
  role,
  projectId,
  projectTitle,
  projectHref,
  checkoutHref,
  partnerId,
  partnerName,
  latestOffer,
  pendingOffer,
  acceptedOffer,
  expiredOffer,
  sortedOffers,
  hasExpiredDeal,
  isNegotiating,
  isPendingPayment,
  isActiveJob,
  isPaid,
  isInProgress,
  isCompleted,
  isCancelled,
  activeAmount,
  activeTimeline,
}: {
  role: 'homeowner' | 'contractor';
  projectId: string;
  projectTitle: string;
  projectHref: string;
  checkoutHref: string;
  partnerId: string;
  partnerName: string;
  latestOffer: DealPanelProps['offers'][number] | null;
  pendingOffer: DealPanelProps['offers'][number] | null;
  acceptedOffer: DealPanelProps['offers'][number] | null;
  expiredOffer: DealPanelProps['offers'][number] | null;
  sortedOffers: DealPanelProps['offers'];
  hasExpiredDeal: boolean;
  isNegotiating: boolean;
  isPendingPayment: boolean;
  isActiveJob: boolean;
  isPaid: boolean;
  isInProgress: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  activeAmount: number;
  activeTimeline: number | null;
}) {
  if (hasExpiredDeal) {
    const reusableOffer = findLatestReusableOffer([
      expiredOffer,
      latestOffer,
      ...sortedOffers,
    ]);

    const parsedMessage = parseOfferMessage(reusableOffer?.message);
    const parsedScope = parseOfferScope(reusableOffer);

    const prefillIncluded =
      parsedMessage.included.length > 0
        ? parsedMessage.included
        : parsedScope.included;

    const prefillExcluded =
      parsedMessage.excluded.length > 0
        ? parsedMessage.excluded
        : parsedScope.excluded;

    const expiredAmount = Number(
      expiredOffer?.amount ?? latestOffer?.amount ?? activeAmount ?? 0,
    );

    const expiredTimeline =
      expiredOffer?.timeline_days ?? latestOffer?.timeline_days ?? activeTimeline;

    const contractorNewOfferHref = projectHref.includes('?')
      ? `${projectHref}&offerMode=new`
      : `${projectHref}?offerMode=new`;

    return (
      <PanelCard>
        <SectionEyebrow tone="red">Expired deal</SectionEyebrow>

        <h3 className="mt-1.5 text-sm font-bold tracking-tight text-slate-950">
          The previous offer expired
        </h3>

        <p className="mt-1.5 text-xs leading-5 text-slate-600">
          The old offer can no longer be accepted or paid. Start a fresh offer
          to continue.
        </p>

        {expiredAmount > 0 && (
          <div className="mt-2.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-red-700">
              Expired amount
            </div>

            <div className="mt-0.5 text-lg font-bold tracking-tight text-red-950">
              {formatCurrency(expiredAmount)}
            </div>

            {expiredTimeline ? (
              <div className="text-xs font-medium text-red-800">
                {expiredTimeline} days
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          {role === 'homeowner' ? (
            <MakeOfferButton
              projectId={projectId}
              projectTitle={projectTitle}
              contractorId={partnerId}
              contractorCompany={partnerName}
              label={reusableOffer ? 'Update budget' : 'Send budget'}
              className="w-full"
              initialAmount={reusableOffer?.amount ?? null}
              initialTimelineDays={reusableOffer?.timeline_days ?? null}
              initialIncluded={prefillIncluded}
              initialExcluded={prefillExcluded}
              initialMessage={parsedMessage.message}
            />
          ) : (
            <Link href={contractorNewOfferHref} className={primaryBtn}>
              Create new offer
            </Link>
          )}

          <Link href={projectHref} className={secondaryBtn}>
            View offer details
          </Link>
        </div>
      </PanelCard>
    );
  }

  if (isPendingPayment) {
    return (
      <PanelCard>
        <SectionEyebrow tone="amber">Next step</SectionEyebrow>

        <h3 className="mt-1.5 text-sm font-bold tracking-tight text-slate-950">
          Payment required
        </h3>

        <p className="mt-1.5 text-xs leading-5 text-slate-600">
          {role === 'homeowner'
            ? 'Complete checkout to secure the deal and unlock direct messaging.'
            : 'The offer has been accepted. Direct chat opens after checkout.'}
        </p>

        {activeAmount > 0 && (
          <OfferAmountBlock amount={activeAmount} timeline={activeTimeline} />
        )}

        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          {role === 'homeowner' ? (
            <>
              <Link href={checkoutHref} className={primaryBtn}>
                Complete checkout
              </Link>

              <Link href={projectHref} className={secondaryBtn}>
                View offer details
              </Link>
            </>
          ) : (
            <Link href={projectHref} className={secondaryBtn}>
              View offer details
            </Link>
          )}
        </div>
      </PanelCard>
    );
  }

  if (isPaid) {
    const commitHref = `/dashboard/contractor/jobs/${projectId}/commit`;
    return (
      <PanelCard>
        <SectionEyebrow tone="amber">Next step</SectionEyebrow>

        <h3 className="mt-1.5 text-sm font-bold tracking-tight text-slate-950">
          {role === 'contractor' ? 'Claim this job' : 'Waiting for the contractor'}
        </h3>

        <p className="mt-1.5 text-xs leading-5 text-slate-600">
          {role === 'homeowner'
            ? 'Payment is held in bidAI escrow. The contractor confirms by paying their commitment fee - chat opens as soon as they do, or you are refunded in full.'
            : 'The homeowner has paid. Pay your commitment fee to claim this job and unlock direct chat.'}
        </p>

        {activeAmount > 0 && (
          <OfferAmountBlock amount={activeAmount} timeline={activeTimeline} />
        )}

        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          {role === 'contractor' ? (
            <Link href={commitHref} className={primaryBtn}>
              Pay commitment fee
            </Link>
          ) : null}

          <Link
            href={projectHref}
            className={role === 'contractor' ? secondaryBtn : primaryBtn}
          >
            View project details
          </Link>
        </div>
      </PanelCard>
    );
  }

  if (isInProgress) {
    return (
      <PanelCard>
        <SectionEyebrow tone="green">Next step</SectionEyebrow>

        <h3 className="mt-1.5 text-sm font-bold tracking-tight text-slate-950">
          Project in progress
        </h3>

        <p className="mt-1.5 text-xs leading-5 text-slate-600">
          {role === 'homeowner'
            ? 'The contractor has committed and the project is active. Mark it complete once the work is finished.'
            : 'You have committed to this job. Coordinate the work directly with the customer.'}
        </p>

        {activeAmount > 0 && (
          <OfferAmountBlock amount={activeAmount} timeline={activeTimeline} />
        )}

        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          <Link href={projectHref} className={primaryBtn}>
            {role === 'homeowner' ? 'Mark complete' : 'Open job'}
          </Link>

          {role === 'contractor' ? (
            <Link href="/dashboard/contractor/earnings" className={secondaryBtn}>
              View earnings
            </Link>
          ) : (
            <Link href={projectHref} className={secondaryBtn}>
              View details
            </Link>
          )}
        </div>
      </PanelCard>
    );
  }

  if (isCompleted) {
    return (
      <PanelCard>
        <SectionEyebrow tone="green">Completed</SectionEyebrow>

        <h3 className="mt-1.5 text-sm font-bold tracking-tight text-slate-950">
          Project completed
        </h3>

        <p className="mt-1.5 text-xs leading-5 text-slate-600">
          {role === 'homeowner'
            ? 'Funds have been released. You can now leave a review.'
            : 'This job is complete and saved in your history.'}
        </p>

        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          {role === 'homeowner' ? (
            <Link href={projectHref} className={primaryBtn}>
              Leave review
            </Link>
          ) : (
            <Link href="/dashboard/contractor/history" className={primaryBtn}>
              View history
            </Link>
          )}

          <Link href={projectHref} className={secondaryBtn}>
            View project details
          </Link>
        </div>
      </PanelCard>
    );
  }

  if (isCancelled) {
    return (
      <PanelCard>
        <SectionEyebrow tone="slate">Closed</SectionEyebrow>

        <h3 className="mt-1.5 text-sm font-bold tracking-tight text-slate-950">
          Deal cancelled
        </h3>

        <p className="mt-1.5 text-xs leading-5 text-slate-600">
          This conversation is closed. No further actions are available.
        </p>

        <div className="mt-2.5">
          <Link href={projectHref} className={secondaryBtn}>
            View project details
          </Link>
        </div>
      </PanelCard>
    );
  }

  if (isNegotiating) {
    const hasPendingOffer = Boolean(pendingOffer);

    const latestSenderRole =
      pendingOffer?.sender_role ?? latestOffer?.sender_role ?? null;

    const waitingForRole =
      latestSenderRole === 'homeowner'
        ? 'contractor'
        : latestSenderRole === 'contractor'
          ? 'homeowner'
          : null;

    const isWaitingForCurrentUser = waitingForRole === role;

    const currentAmount = Number(
      pendingOffer?.amount ?? latestOffer?.amount ?? 0,
    );

    const currentTimeline =
      pendingOffer?.timeline_days ?? latestOffer?.timeline_days ?? null;

    const reusableOffer = findLatestReusableOffer(sortedOffers);
    const parsedMessage = parseOfferMessage(reusableOffer?.message);
    const parsedScope = parseOfferScope(reusableOffer);

    const prefillIncluded =
      parsedMessage.included.length > 0
        ? parsedMessage.included
        : parsedScope.included;

    const prefillExcluded =
      parsedMessage.excluded.length > 0
        ? parsedMessage.excluded
        : parsedScope.excluded;

    const homeownerButtonLabel = getHomeownerOfferButtonLabel({
      pendingOffer,
      reusableOffer,
      role,
    });

    const contractorOfferHref = projectHref.includes('?')
      ? `${projectHref}&offerMode=new`
      : `${projectHref}?offerMode=new`;

    return (
      <PanelCard>
        <SectionEyebrow tone="amber">Next step</SectionEyebrow>

        <h3 className="mt-1.5 text-sm font-bold tracking-tight text-slate-950">
          {hasPendingOffer
            ? isWaitingForCurrentUser
              ? 'Offer needs your response'
              : 'Offer awaiting response'
            : 'Start negotiation'}
        </h3>

        <p className="mt-1.5 text-xs leading-5 text-slate-600">
          {hasPendingOffer
            ? isWaitingForCurrentUser
              ? 'Review the active offer and choose accept, counter, or decline.'
              : 'Waiting for the other side to respond.'
            : role === 'homeowner'
              ? 'Send a clear budget request to start the negotiation.'
              : 'Create a contractor offer to start the negotiation.'}
        </p>

        {currentAmount > 0 && (
          <div className="mt-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Current offer
            </div>

            <OfferAmountBlock amount={currentAmount} timeline={currentTimeline} />
          </div>
        )}

        {hasPendingOffer && isWaitingForCurrentUser && (
          <div className="mt-2.5 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
            <div className="text-xs font-semibold text-amber-900">
              Response required
            </div>

            <p className="mt-0.5 text-[11px] leading-4 text-amber-800">
              Use the offer card in the chat to accept, decline, or send a
              counter offer.
            </p>
          </div>
        )}

        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          {role === 'homeowner' ? (
            <MakeOfferButton
              projectId={projectId}
              projectTitle={projectTitle}
              contractorId={partnerId}
              contractorCompany={partnerName}
              label={homeownerButtonLabel}
              className="w-full"
              initialAmount={reusableOffer?.amount ?? null}
              initialTimelineDays={reusableOffer?.timeline_days ?? null}
              initialIncluded={prefillIncluded}
              initialExcluded={prefillExcluded}
              initialMessage={parsedMessage.message}
            />
          ) : (
            <Link href={contractorOfferHref} className={primaryBtn}>
              {hasPendingOffer ? 'Review offer' : 'Create offer'}
            </Link>
          )}

          <Link href={projectHref} className={secondaryBtn}>
            View offer details
          </Link>
        </div>
      </PanelCard>
    );
  }

  /**
   * Fallback for unknown project statuses.
   * Marketplace should never show a broken empty panel.
   */
  return (
    <PanelCard>
      <SectionEyebrow tone="slate">Status</SectionEyebrow>

      <h3 className="mt-1.5 text-sm font-bold tracking-tight text-slate-950">
        Deal status unavailable
      </h3>

      <p className="mt-1.5 text-xs leading-5 text-slate-600">
        Open the project details to review the latest information.
      </p>

      <div className="mt-2.5">
        <Link href={projectHref} className={secondaryBtn}>
          View project details
        </Link>
      </div>
    </PanelCard>
  );
}

function OverviewCard({
  title,
  category,
  zip,
  partnerName,
  chatUnlocked,
  status,
  projectHref,
  hasActiveOffer,
  contractorContact,
  role,
  partnerId,
  messagesHref,
}: {
  title: string;
  category: string | null;
  zip: string | null;
  partnerName: string;
  chatUnlocked: boolean;
  status: string;
  projectHref: string;
  hasActiveOffer: boolean;
  contractorContact?: {
    phone?: string | null;
    website?: string | null;
    address_line?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  } | null;
  role: 'homeowner' | 'contractor';
  partnerId: string;
  messagesHref: string;
}) {
  const [showContact, setShowContact] = useState(false);
  const pill = getStatusPill(status);
  const topLabel = hasActiveOffer ? 'View offer details' : 'View project details';
  const canRevealContact = chatUnlocked && Boolean(contractorContact);

  // Profile link — only shown once chat is unlocked (job is active)
  const profileHref =
    role === 'homeowner'
      ? `/dashboard/contractors/${partnerId}`
      : `/dashboard/homeowner/profile/${partnerId}`;

  return (
    <PanelCard>
      {/* Pinned at the very top of the deal room - this is what both sides
          should check carefully before accepting or paying anything. */}
      <Link
        href={projectHref}
        className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800 transition hover:bg-orange-100"
      >
        <span>{topLabel}</span>
        <span aria-hidden="true">→</span>
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Deal room
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${pill.tone}`}
            >
              {pill.label}
            </span>
          </div>

          <h2 className="mt-1 truncate text-lg font-bold tracking-tight text-slate-950">
            {title}
          </h2>

          <p className="mt-0.5 text-xs text-slate-500">
            {category ?? 'Renovation'}
            {zip ? ` · ZIP ${zip}` : ''}
          </p>

          <div className="mt-2">
            {canRevealContact ? (
              <button
                type="button"
                onClick={() => setShowContact((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-orange-700"
              >
                With{' '}
                <span className="font-semibold text-slate-900 underline decoration-dotted decoration-slate-400">
                  {partnerName}
                </span>
                <span className="text-[9px]">{showContact ? '▲' : '▼'}</span>
              </button>
            ) : (
              <p className="text-xs text-slate-600">
                With{' '}
                <span className="font-semibold text-slate-900">{partnerName}</span>
              </p>
            )}
          </div>

          {!chatUnlocked && (
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              Contact details unlock once the contractor commits to the job.
            </p>
          )}

          {showContact && contractorContact && (
            <div className="mt-2 space-y-1 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
              {contractorContact.phone && (
                <a
                  href={`tel:${contractorContact.phone}`}
                  className="flex items-center gap-1.5 text-xs text-slate-700"
                >
                  📞 {contractorContact.phone}
                </a>
              )}
              {contractorContact.website && (
                <a
                  href={contractorContact.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-[#f45112]"
                >
                  🌐 {contractorContact.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {contractorContact.address_line && (
                <div className="flex items-start gap-1.5 text-xs text-slate-600">
                  📍{' '}
                  <span>
                    {contractorContact.address_line}
                    {contractorContact.city && `, ${contractorContact.city}`}
                    {contractorContact.state && `, ${contractorContact.state}`}
                    {contractorContact.zip_code && ` ${contractorContact.zip_code}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* View full profile — always shown in a conversation context */}
          <div className="mt-2">
            <Link
              href={profileHref}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:underline"
            >
              👤 View profile →
            </Link>
          </div>
        </div>
      </div>
    </PanelCard>
  );
}

function MarketplaceRuleCard({
  role,
  projectStatus,
  amount,
}: {
  role: 'homeowner' | 'contractor';
  projectStatus: string;
  amount: number;
}) {
  const feePct = Math.round(COMMITMENT_FEE_PCT * 100);
  const fee = amount > 0 ? commitmentFee(amount) : 0;

  const statusLine =
    projectStatus === 'paid'
      ? role === 'contractor'
        ? `Homeowner paid. Pay your ${feePct}% commitment fee to claim the job.`
        : 'Payment held in escrow. Contractor must pay their commitment fee to unlock chat.'
      : projectStatus === 'pending_payment' || projectStatus === 'awarded'
        ? role === 'homeowner'
          ? 'After checkout, the contractor still needs to confirm before chat opens.'
          : 'Offer accepted, but not active until the homeowner completes checkout.'
        : role === 'contractor'
          ? `You'll pay a ${feePct}% commitment fee if the homeowner accepts and pays.`
          : `Accept → you pay first → contractor pays a ${feePct}% fee to confirm → chat opens.`;

  return (
    <PanelCard>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-600">
          Marketplace rule
        </div>
        {role === 'contractor' && amount > 0 && (
          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black text-orange-700">
            Est. fee {formatCurrency(fee)}
          </span>
        )}
      </div>

      <p className="mt-1.5 text-xs leading-5 text-slate-600">{statusLine}</p>
    </PanelCard>
  );
}

function OfferAmountBlock({
  amount,
  timeline,
}: {
  amount: number;
  timeline: number | null;
}) {
  return (
    <div className="mt-1">
      <div className="text-xl font-bold tracking-tight text-slate-950">
        {formatCurrency(amount)}
      </div>

      {timeline ? (
        <div className="text-xs text-slate-500">{timeline} days</div>
      ) : null}
    </div>
  );
}

function PanelCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
      {children}
    </section>
  );
}

function SectionEyebrow({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'amber' | 'green' | 'red' | 'slate';
}) {
  const tones = {
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
  } as const;

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function getStatusPill(status: string): { label: string; tone: string } {
  if (status === 'pending_payment') {
    return { label: 'Payment required', tone: 'bg-amber-50 text-amber-700' };
  }

  if (status === 'paid') {
    return { label: 'Awaiting contractor', tone: 'bg-orange-50 text-orange-700' };
  }

  if (status === 'in_progress') {
    return { label: 'In progress', tone: 'bg-emerald-50 text-emerald-700' };
  }

  if (status === 'completed') {
    return { label: 'Completed', tone: 'bg-emerald-50 text-emerald-700' };
  }

  if (status === 'cancelled') {
    return { label: 'Cancelled', tone: 'bg-slate-100 text-slate-600' };
  }

  if (status === 'open') {
    return { label: 'Open', tone: 'bg-slate-100 text-slate-600' };
  }

  if (status === 'quoted' || status === 'in_review' || status === 'negotiating') {
    return { label: 'Negotiating', tone: 'bg-amber-50 text-amber-700' };
  }

  return { label: readableStatus(status), tone: 'bg-slate-100 text-slate-600' };
}

function getHomeownerOfferButtonLabel({
  pendingOffer,
  reusableOffer,
  role,
}: {
  pendingOffer: DealPanelProps['offers'][number] | null;
  reusableOffer: DealPanelProps['offers'][number] | null;
  role: 'homeowner' | 'contractor';
}) {
  if (role !== 'homeowner') return 'Send offer';

  if (pendingOffer?.sender_role === 'contractor') {
    return 'Counter offer';
  }

  if (pendingOffer?.sender_role === 'homeowner') {
    return 'Update budget';
  }

  return reusableOffer ? 'Update budget' : 'Send budget';
}

function findLatestReusableOffer(
  offers: Array<DealPanelProps['offers'][number] | null | undefined>,
): DealPanelProps['offers'][number] | null {
  const reusableKinds = [
    'budget_offer',
    'contractor_offer',
    'counter_offer',
    'quick_offer',
    'homeowner_budget',
    'contractor_quote',
    'homeowner_counter',
    'contractor_counter',
  ];

  const reusableStatuses = [
    'pending',
    'countered',
    'accepted',
    'expired',
    'rejected',
    'withdrawn',
    'payment_pending',
    'paid',
  ];

  const validOffers = offers.filter(
    (offer): offer is DealPanelProps['offers'][number] =>
      Boolean(
        offer &&
          reusableKinds.includes(String(offer.kind)) &&
          reusableStatuses.includes(String(offer.status)),
      ),
  );

  if (validOffers.length === 0) return null;

  return [...validOffers].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  })[0];
}

function parseOfferMessage(message?: string | null): {
  message: string | null;
  included: string[];
  excluded: string[];
} {
  if (!message) return { message: null, included: [], excluded: [] };
  try {
    const parsed = JSON.parse(message);
    return {
      message: typeof parsed.message === 'string' ? parsed.message : null,
      included: Array.isArray(parsed.included)
        ? parsed.included.map((item: any) => String(item).trim()).filter(Boolean)
        : [],
      excluded: Array.isArray(parsed.excluded)
        ? parsed.excluded.map((item: any) => String(item).trim()).filter(Boolean)
        : [],
    };
  } catch {
    return { message, included: [], excluded: [] };
  }
}

function parseOfferScope(
  offer?: DealPanelProps['offers'][number] | null,
): { included: string[]; excluded: string[] } {
  if (!offer) return { included: [], excluded: [] };
  const includedFromArray = normalizeItems(offer.included_items);
  const excludedFromArray = normalizeItems(offer.excluded_items);
  if (includedFromArray.length > 0 || excludedFromArray.length > 0) {
    return { included: includedFromArray, excluded: excludedFromArray };
  }
  return parseScopeSummary(offer.scope_summary);
}

function parseScopeSummary(scopeSummary?: string | null): {
  included: string[];
  excluded: string[];
} {
  if (!scopeSummary) return { included: [], excluded: [] };
  const lines = scopeSummary.split('\n').map((line) => line.trim()).filter(Boolean);
  const included: string[] = [];
  const excluded: string[] = [];
  let mode: 'included' | 'excluded' | null = null;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('included')) { mode = 'included'; continue; }
    if (lower.startsWith('excluded')) { mode = 'excluded'; continue; }
    const cleaned = line.replace(/^[-•]\s*/, '').trim();
    if (!cleaned) continue;
    if (mode === 'included') included.push(cleaned);
    if (mode === 'excluded') excluded.push(cleaned);
  }
  return { included, excluded };
}

function normalizeItems(value?: string[] | string | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(/\n|,|;|•/)
    .map((item) => item.replace(/^[-\u2013\u2014]\s*/, '').trim())
    .filter(Boolean)
    .filter((item) => {
      const lowered = item.toLowerCase();
      return !['not specified', 'no exclusions listed', 'no additional notes'].includes(lowered);
    });
}

