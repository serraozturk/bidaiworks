import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatRange, relativeTime } from '@/lib/utils';
import { MakeOfferButton } from '@/components/MakeOfferButton';
import ReviewForm from '@/components/ReviewForm';
import MarkCompleteButton from '@/components/MarkCompleteButton';
import { SupportDisputePanel } from '@/components/SupportDisputePanel';
import OfferActions from './offer-actions';
import { countUnreadConversations } from '@/lib/unread';

interface Params {
  params: { id: string };
  searchParams?: {
    returnTo?: string;
    dispute_raised?: string;
    dispute_error?: string;
    dispute_exists?: string;
  };
}

type OfferRow = {
  id: string;
  project_id: string;
  conversation_id: string | null;
  parent_offer_id: string | null;
  sender_id: string;
  sender_role: 'homeowner' | 'contractor';
  recipient_id: string | null;
  recipient_role: 'homeowner' | 'contractor' | null;
  kind: string | null;
  amount: number;
  timeline_days: number | null;
  status: string;
  scope_summary: string | null;
  included_items: string[] | string | null;
  excluded_items: string[] | string | null;
  notes: string[] | string | null;
  message: string | null;
  created_at: string;
};

type ContractorProfile = {
  user_id: string;
  company_name: string | null;
  license_number: string | null;
  bio: string | null;
  years_in_business: number | null;
  rating_avg: number | null;
  rating_count: number | null;
  verified: boolean | null;
  logo_url: string | null;
  // Contact fields — only populated for the awarded contractor once in_progress/completed
  phone?: string | null;
  website?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
};

type DisplayOffer = OfferRow & {
  contractorId: string | null;
  contractor: ContractorProfile | null;
  threadKey: string;
};

const NEGOTIATION_PROJECT_STATUSES = [
  'open',
  'in_review',
  'quoted',
  'negotiating',
  'expired',
];

const LOCKED_PROJECT_STATUSES = [
  'pending_payment',
  'awarded',
  'paid',
  'in_progress',
  'completed',
  'cancelled',
];

const ACTIVE_OFFER_STATUSES = [
  'pending',
  'countered',
  'payment_pending',
  'accepted',
];

export default async function HomeownerProjectDetail({
  params,
  searchParams,
}: Params) {
  const returnTo = searchParams?.returnTo;

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Recover any stale payment / commitment windows before rendering.
  await supabase.rpc('expire_stale_deals').then(() => undefined, () => undefined);

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select(
      `
      *,
      categories(name, slug),
      project_photos(id, url, caption, position)
    `,
    )
    .eq('id', params.id)
    .eq('homeowner_id', user.id)
    .single();

  if (projectError) {
    console.error('Homeowner project detail query error:', projectError);
  }

  if (!project) notFound();

  const [{ data: offers, error: offersError }, unreadMessages] =
    await Promise.all([
      supabase
        .from('offers')
        .select(
          `
          id,
          project_id,
          conversation_id,
          parent_offer_id,
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
          created_at
        `,
        )
        .eq('project_id', project.id)
        .order('created_at', { ascending: false }),

      countUnreadConversations(supabase, user.id, 'homeowner'),
    ]);

  if (offersError) {
    console.error('Project offers query error:', offersError);
    throw new Error(offersError.message);
  }

  const offerRows = ((offers ?? []) as OfferRow[]).sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const contractorIds = Array.from(
    new Set(
      offerRows
        .map((offer) => getContractorIdFromOffer(offer))
        .filter((id): id is string => Boolean(id)),
    ),
  );

  let contractorById = new Map<string, ContractorProfile>();

  if (contractorIds.length > 0) {
    const { data: contractors, error: contractorsError } = await supabase
      .from('contractor_profiles')
      .select(
        `
        user_id,
        company_name,
        license_number,
        bio,
        years_in_business,
        rating_avg,
        rating_count,
        verified,
        logo_url,
        phone,
        website,
        address_line,
        city,
        state,
        zip_code
      `,
      )
      .in('user_id', contractorIds);

    if (contractorsError) {
      console.error('Project detail contractor query error:', contractorsError);
      throw new Error(contractorsError.message);
    }

    contractorById = new Map(
      ((contractors ?? []) as ContractorProfile[]).map((contractor) => [
        contractor.user_id,
        contractor,
      ]),
    );
  }

  const displayOffers = buildLatestDisplayOffers(offerRows, contractorById);

  const status = String(project.status ?? 'open');

  const selectedOfferId =
    project.selected_offer_id ?? project.awarded_offer_id ?? null;

  const selectedOffer =
    offerRows.find((offer) => offer.id === selectedOfferId) ?? null;

  const selectedContractorId = selectedOffer
    ? getContractorIdFromOffer(selectedOffer)
    : null;

  const selectedContractor = selectedContractorId
    ? contractorById.get(selectedContractorId) ?? null
    : null;

  const negotiating = NEGOTIATION_PROJECT_STATUSES.includes(status);
  const isPendingPayment =
    status === 'pending_payment' || status === 'awarded';
  // `paid` = homeowner has paid, awaiting the contractor's commitment fee.
  // `in_progress` = contractor committed and the job is live.
  const isPaid = status === 'paid';
  const isInProgress = status === 'in_progress';
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';
  const isLocked = LOCKED_PROJECT_STATUSES.includes(status);

  const pendingOfferCount = displayOffers.filter((offer) =>
    ['pending', 'countered', 'payment_pending'].includes(offer.status),
  ).length;

  const needsReviewCount = displayOffers.filter((offer) =>
    isHomeownerTurn(offer),
  ).length;

  const paymentPendingOffer = displayOffers.find(
    (offer) => offer.status === 'payment_pending',
  );

  const canReview = Boolean(selectedContractor && isCompleted);

  const { data: existingReview } = canReview
    ? await supabase
        .from('reviews')
        .select('id, rating, comment')
        .eq('project_id', project.id)
        .eq('reviewer_id', user.id)
        .maybeSingle()
    : { data: null };

  const categoryName = firstRow<any>(project.categories)?.name ?? 'Renovation';

  const projectPhotos = ((project.project_photos ?? []) as any[]).sort(
    (a, b) => Number(a.position ?? 0) - Number(b.position ?? 0),
  );

  const { data: disputeRows } = await supabase
    .from('disputes')
    .select(
      'id, status, category, priority, requested_resolution, reason, admin_note, resolution, created_at, resolved_at',
    )
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role="homeowner"
          active="projects"
          messageCount={unreadMessages ?? 0}
          quoteCount={pendingOfferCount}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1480px] px-5 py-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <Link
                href={returnTo || '/dashboard/homeowner'}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#0f172a]"
              >
                {returnTo ? '← Back to messages' : '← Back to dashboard'}
              </Link>

              <div className="flex flex-wrap gap-2">
                {displayOffers.length > 0 && (
                  <Link
                    href={`/dashboard/homeowner/compare?project=${project.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-[#0f172a] shadow-sm transition hover:bg-slate-50"
                  >
                    Compare offers
                  </Link>
                )}

                <Link
                  href="/dashboard/messages"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[#f45112] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#d94406]"
                >
                  Messages
                </Link>
              </div>
            </div>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-5">
                <ProjectHeader
                  title={project.title}
                  categoryName={categoryName}
                  zipCode={project.zip_code}
                  city={project.city}
                  state={project.state}
                  createdAt={project.created_at}
                  status={status}
                  photos={projectPhotos}
                  offerCount={displayOffers.length}
                  needsReviewCount={needsReviewCount}
                />

                <ProjectSummary
                  description={project.description}
                  aiEstimateMin={project.ai_estimate_min}
                  aiEstimateMax={project.ai_estimate_max}
                  aiReasoning={project.ai_estimate_reasoning}
                  budgetMin={project.budget_min}
                  budgetMax={project.budget_max}
                  squareFootage={project.square_footage}
                  desiredStartDate={project.desired_start_date}
                  qualityLevel={project.quality_level}
                  projectScope={project.project_scope}
                  materialPreferences={project.material_preferences}
                />

                {projectPhotos.length > 0 && (
                  <PhotoGallery photos={projectPhotos} />
                )}

                {status === 'expired' && (
                  <NoticeBox
                    tone="danger"
                    title="Expired project"
                    text="The previous offer expired. You can review the project history and restart negotiation from the deal room by creating a fresh budget request."
                  />
                )}
              </div>

              <aside className="space-y-5">
                <StatusPanel
                  projectId={project.id}
                  status={status}
                  selectedOffer={selectedOffer}
                  selectedContractor={selectedContractor}
                  paymentPendingOffer={paymentPendingOffer ?? null}
                />

                <PlatformRulesBox />

                {searchParams?.dispute_raised === '1' && (
                  <NoticeBox
                    tone="neutral"
                    title="Dispute opened"
                    text="bidAI support has received your dispute. Keep all updates inside the platform while the team reviews the case."
                  />
                )}

                {searchParams?.dispute_exists === '1' && (
                  <NoticeBox
                    tone="neutral"
                    title="Dispute already open"
                    text="This project already has an active dispute. Add details through support instead of opening a duplicate case."
                  />
                )}

                {searchParams?.dispute_error === '1' && (
                  <NoticeBox
                    tone="danger"
                    title="Dispute could not be opened"
                    text="Please add a clear reason and try again. If it still fails, send a support request."
                  />
                )}

                <SupportDisputePanel
                  projectId={project.id}
                  projectStatus={status}
                  role="homeowner"
                  backTo={`/dashboard/homeowner/projects/${project.id}`}
                  disputes={(disputeRows ?? []) as any[]}
                />

                {(isInProgress || isCompleted) && selectedContractor && (
                  <section className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm">
                    <div className="text-xs font-black uppercase tracking-wide text-emerald-700">
                      {isInProgress ? 'Work in progress' : 'Project completed'}
                    </div>

                    {isInProgress && (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Payment is confirmed and held by bidAI. When the project
                        is finished, mark it complete to release funds.
                      </p>
                    )}

                    {/* Contractor contact info — revealed only after deal is confirmed */}
                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 space-y-1.5">
                      <div className="text-[11px] font-black uppercase tracking-wide text-emerald-700">
                        Contractor contact
                      </div>
                      <div className="text-sm font-black text-slate-900">{selectedContractor.company_name}</div>
                      {selectedContractor.phone && (
                        <a href={`tel:${selectedContractor.phone}`} className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-[#f45112]">
                          <span>📞</span> {selectedContractor.phone}
                        </a>
                      )}
                      {selectedContractor.website && (
                        <a href={selectedContractor.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-[#f45112] hover:underline">
                          <span>🌐</span> {selectedContractor.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                      {selectedContractor.address_line && (
                        <div className="flex items-start gap-1.5 text-sm text-slate-600">
                          <span>📍</span>
                          <span>
                            {selectedContractor.address_line}
                            {selectedContractor.city && `, ${selectedContractor.city}`}
                            {selectedContractor.state && `, ${selectedContractor.state}`}
                            {selectedContractor.zip_code && ` ${selectedContractor.zip_code}`}
                          </span>
                        </div>
                      )}
                    </div>

                    {isInProgress && selectedOffer && (
                      <div className="mt-4">
                        <MarkCompleteButton
                          projectId={project.id}
                          contractorId={selectedContractor.user_id}
                        />
                      </div>
                    )}
                  </section>
                )}

                {isPendingPayment && selectedOffer && (
                  <section className="rounded-lg border border-orange-200 bg-orange-50 p-4 shadow-sm">
                    <div className="text-xs font-black uppercase tracking-wide text-orange-700">
                      Checkout required
                    </div>

                    <p className="mt-2 text-sm leading-6 text-orange-900/80">
                      The contractor is not booked until checkout is completed.
                      Your payment stays protected in bidAI escrow.
                    </p>

                    <Link
                      href={`/dashboard/checkout/project/${project.id}`}
                      className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#f4510b] px-4 text-sm font-black text-white transition hover:bg-[#d94406]"
                    >
                      Continue checkout
                    </Link>
                  </section>
                )}

                {isPaid && (
                  <section className="rounded-lg border border-violet-200 bg-violet-50 p-4 shadow-sm">
                    <div className="text-xs font-black uppercase tracking-wide text-violet-700">
                      Payment complete - awaiting contractor
                    </div>

                    <p className="mt-2 text-sm leading-6 text-violet-900/80">
                      Your payment is held safely in bidAI escrow.{' '}
                      {selectedContractor?.company_name ?? 'The contractor'} now
                      has 48 hours to confirm this job by paying their
                      commitment fee. Direct chat and the active job stage open
                      as soon as they commit.
                    </p>

                    <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-violet-900/75">
                      If the contractor does not confirm in time, you are
                      refunded in full and the project re-opens so you can
                      choose another contractor.
                    </p>
                  </section>
                )}

                {isCancelled && (
                  <NoticeBox
                    tone="neutral"
                    title="Project closed"
                    text="This project has been cancelled. No new offers or actions are available."
                  />
                )}
              </aside>
            </section>

            {canReview && selectedContractor && (
              <section className="mt-5 rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-emerald-700">
                      Project review
                    </div>

                    <h2 className="mt-1 text-lg font-black">
                      Review {selectedContractor.company_name ?? 'Contractor'}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Share your experience to help other homeowners choose the
                      right contractor.
                    </p>
                  </div>

                  {existingReview && (
                    <Badge tone="success">
                      You rated {existingReview.rating}/5
                    </Badge>
                  )}
                </div>

                <div className="mt-4">
                  <ReviewForm
                    projectId={project.id}
                    contractorId={selectedContractor.user_id}
                    contractorName={
                      selectedContractor.company_name ?? 'Contractor'
                    }
                    existingReview={existingReview ?? null}
                  />
                </div>
              </section>
            )}

            <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-black text-[#0f172a]">
                    Current offers
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Latest active offer per contractor or deal room.
                  </p>
                </div>

                {displayOffers.length > 0 && (
                  <Link
                    href={`/dashboard/homeowner/compare?project=${project.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f45112] px-3 text-xs font-black text-white transition hover:bg-[#d94406]"
                  >
                    Compare all
                  </Link>
                )}
              </div>

              {displayOffers.length === 0 ? (
                <EmptyOffers projectId={project.id} />
              ) : (
                <div className="divide-y divide-slate-100">
                  {displayOffers.map((offer) => (
                    <OfferDecisionRow
                      key={offer.threadKey}
                      offer={offer}
                      project={project}
                      status={status}
                      selectedOfferId={selectedOfferId}
                      negotiating={negotiating}
                      isLocked={isLocked}
                    />
                  ))}
                </div>
              )}
            </section>

            {offerRows.length > displayOffers.length && (
              <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-base font-black text-[#0f172a]">
                    Offer history
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Older negotiation steps are kept here for transparency.
                  </p>
                </div>

                <div className="divide-y divide-slate-100">
                  {offerRows.map((offer) => {
                    const contractorId = getContractorIdFromOffer(offer);
                    const contractor = contractorId
                      ? contractorById.get(contractorId) ?? null
                      : null;

                    return (
                      <HistoryRow
                        key={offer.id}
                        offer={offer}
                        contractor={contractor}
                        selectedOfferId={selectedOfferId}
                      />
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function ProjectHeader({
  title,
  categoryName,
  zipCode,
  city,
  state,
  createdAt,
  status,
  photos,
  offerCount,
  needsReviewCount,
}: {
  title: string;
  categoryName: string;
  zipCode: string | null;
  city: string | null;
  state: string | null;
  createdAt: string;
  status: string;
  photos: any[];
  offerCount: number;
  needsReviewCount: number;
}) {
  const cover = photos[0]?.url ?? null;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="h-56 bg-slate-100 md:h-full">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
              Project
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-black tracking-tight md:text-3xl">
                  {title}
                </h1>

                <ProjectStatusBadge status={status} />
              </div>

              <p className="mt-2 text-sm font-semibold text-slate-500">
                {categoryName}
                {zipCode ? ` · ZIP ${zipCode}` : ''}
                {city ? ` · ${city}` : ''}
                {state ? `, ${state}` : ''}
                {createdAt ? ` · posted ${relativeTime(createdAt)}` : ''}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <HeaderMetric label="Current offers" value={String(offerCount)} />
            <HeaderMetric label="Needs review" value={String(needsReviewCount)} />
            <HeaderMetric label="Photos" value={String(photos.length)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-lg font-black text-[#0f172a]">
        {value}
      </div>
    </div>
  );
}

function ProjectSummary({
  description,
  aiEstimateMin,
  aiEstimateMax,
  aiReasoning,
  budgetMin,
  budgetMax,
  squareFootage,
  desiredStartDate,
  qualityLevel,
  projectScope,
  materialPreferences,
}: {
  description: string | null;
  aiEstimateMin: number | null;
  aiEstimateMax: number | null;
  aiReasoning: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  squareFootage: number | null;
  desiredStartDate: string | null;
  qualityLevel: string | null;
  projectScope: string | null;
  materialPreferences: string | null;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-3">
        <InfoBlock
          label="AI estimate"
          value={formatRange(aiEstimateMin, aiEstimateMax)}
        />

        <InfoBlock
          label="Homeowner budget"
          value={formatRange(budgetMin, budgetMax)}
        />

        <InfoBlock
          label="Project size"
          value={squareFootage ? `${squareFootage} sq ft` : 'Not specified'}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <InfoBlock
          label="Scope"
          value={projectScope ? readableStatus(projectScope) : 'Not specified'}
          small
        />

        <InfoBlock
          label="Finish level"
          value={qualityLevel ? readableStatus(qualityLevel) : 'Not specified'}
          small
        />

        <InfoBlock
          label="Desired start"
          value={desiredStartDate ? formatDate(desiredStartDate) : 'Flexible'}
          small
        />
      </div>

      <div className="mt-5">
        <div className="text-xs font-black uppercase tracking-wide text-slate-500">
          Description
        </div>

        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {description || 'No description provided.'}
        </p>
      </div>

      {materialPreferences && (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-xs font-black uppercase tracking-wide text-slate-500">
            Material preferences
          </div>

          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {materialPreferences}
          </p>
        </div>
      )}

      {aiReasoning && (
        <div className="mt-5 rounded-lg border border-orange-100 bg-orange-50 px-4 py-3">
          <div className="text-xs font-black uppercase tracking-wide text-orange-700">
            Estimate reasoning
          </div>

          <p className="mt-1 text-sm leading-6 text-orange-900/80">
            {aiReasoning}
          </p>
        </div>
      )}
    </section>
  );
}

function InfoBlock({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div
        className={[
          'mt-1 font-black text-[#0f172a]',
          small ? 'text-sm' : 'text-base',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  );
}

function PhotoGallery({ photos }: { photos: any[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black text-[#0f172a]">Project photos</h2>

        <span className="text-xs font-bold text-slate-500">
          {photos.length} photo{photos.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo) => (
          <a
            key={photo.id}
            href={photo.url}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.caption ?? 'project photo'}
              className="h-32 w-full object-cover transition hover:scale-105"
            />
          </a>
        ))}
      </div>
    </section>
  );
}

function StatusPanel({
  projectId,
  status,
  selectedOffer,
  selectedContractor,
  paymentPendingOffer,
}: {
  projectId: string;
  status: string;
  selectedOffer: OfferRow | null;
  selectedContractor: ContractorProfile | null;
  paymentPendingOffer: DisplayOffer | null;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-slate-500">
            Current status
          </div>

          <div className="mt-2">
            <ProjectStatusBadge status={status} />
          </div>
        </div>
      </div>

      {selectedOffer && selectedContractor ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
            Selected contractor
          </div>

          <div className="mt-2 text-sm font-black text-[#0f172a]">
            {selectedContractor.company_name ?? 'Contractor'}
          </div>

          <div className="mt-1 text-2xl font-black text-[#0f172a]">
            {formatCurrency(Number(selectedOffer.amount))}
          </div>

          <div className="text-xs text-slate-500">
            {selectedOffer.timeline_days
              ? `${selectedOffer.timeline_days} day timeline`
              : 'Timeline TBD'}
          </div>

          {['in_progress', 'completed'].includes(status) ? (
            <Link
              href={`/dashboard/messages/${projectId}/${selectedContractor.user_id}`}
              className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-[#0f172a] transition hover:bg-slate-50"
            >
              Open chat
            </Link>
          ) : (
            <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-500">
              {status === 'paid'
                ? 'Direct chat opens once the contractor pays their commitment fee.'
                : 'Direct chat opens after checkout is completed.'}
            </p>
          )}
        </div>
      ) : paymentPendingOffer ? (
        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
          <div className="text-[11px] font-black uppercase tracking-wide text-orange-700">
            Checkout waiting
          </div>

          <div className="mt-2 text-sm font-black text-orange-950">
            {paymentPendingOffer.contractor?.company_name ?? 'Contractor'}
          </div>

          <div className="mt-1 text-xl font-black text-orange-950">
            {formatCurrency(Number(paymentPendingOffer.amount))}
          </div>

          <Link
            href={`/dashboard/checkout/project/${projectId}`}
            className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl bg-[#f4510b] px-3 text-xs font-black text-white transition hover:bg-[#d94406]"
          >
            Continue checkout
          </Link>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-slate-500">
          No contractor has been selected yet. Review current offers or compare
          them before deciding.
        </p>
      )}
    </section>
  );
}

function OfferDecisionRow({
  offer,
  project,
  status,
  selectedOfferId,
  negotiating,
  isLocked,
}: {
  offer: DisplayOffer;
  project: any;
  status: string;
  selectedOfferId: string | null;
  negotiating: boolean;
  isLocked: boolean;
}) {
  const company = offer.contractor?.company_name ?? 'Contractor';
  const isWinner = selectedOfferId === offer.id;
  const scope = normalizeOfferScope(offer);
  const homeownerTurn = isHomeownerTurn(offer);
  const isHomeownerOffer = offer.sender_role === 'homeowner';

  const messageHref = offer.contractorId
    ? `/dashboard/messages/${project.id}/${offer.contractorId}`
    : `/dashboard/homeowner/projects/${project.id}`;

  const canMakeOffer =
    negotiating &&
    !isLocked &&
    offer.contractorId &&
    !['accepted', 'rejected', 'payment_pending', 'expired', 'withdrawn'].includes(
      offer.status,
    );

  return (
    <article
      className={[
        'grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_260px]',
        homeownerTurn ? 'bg-orange-50/50' : isWinner ? 'bg-emerald-50/40' : 'bg-white',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-black text-[#0f172a]">
            {isHomeownerOffer ? `Your offer to ${company}` : company}
          </h3>

          {offer.contractor?.verified && <Badge tone="success">Verified</Badge>}
          {isWinner && <Badge tone="success">Selected</Badge>}
          {homeownerTurn && <Badge tone="warning">Your turn</Badge>}
          <OfferStatusBadge status={offer.status} />
        </div>

        <p className="mt-1 text-xs font-semibold text-slate-500">
          {isHomeownerOffer ? (
            <>Sent by you · waiting for contractor response</>
          ) : (
            <>
              {offer.contractor?.years_in_business
                ? `${offer.contractor.years_in_business} yrs · `
                : ''}
              {offer.contractor?.rating_count && offer.contractor.rating_count > 0
                ? `★ ${Number(offer.contractor.rating_avg).toFixed(1)} (${offer.contractor.rating_count} reviews)`
                : 'New contractor'}
            </>
          )}

          {offer.created_at ? ` · ${relativeTime(offer.created_at)}` : ''}
        </p>

        {offer.contractor?.bio && (
          <p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-600">
            {offer.contractor.bio}
          </p>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ScopeBox
            title="Included"
            tone="included"
            items={scope.included}
            emptyText="Not specified"
          />

          <ScopeBox
            title="Excluded"
            tone="excluded"
            items={scope.excluded}
            emptyText="No exclusions listed"
          />

          <ScopeBox
            title="Notes"
            tone="notes"
            items={scope.notes}
            emptyText="No additional notes"
          />
        </div>
      </div>

      <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
          Latest offer
        </div>

        <div className="mt-1 text-2xl font-black tracking-tight text-[#0f172a]">
          {formatCurrency(Number(offer.amount))}
        </div>

        <div className="mt-1 text-xs font-semibold text-slate-500">
          {offer.timeline_days
            ? `${offer.timeline_days} day timeline`
            : 'Timeline TBD'}
        </div>

        <div className="mt-4 grid gap-2">
          <Link
            href={messageHref}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-[#0f172a] transition hover:bg-slate-50"
          >
            Deal room
          </Link>

          {canMakeOffer && offer.contractorId && (
            <MakeOfferButton
              projectId={project.id}
              projectTitle={project.title}
              contractorId={offer.contractorId}
              contractorCompany={company}
              contractorRating={offer.contractor?.rating_avg ?? null}
              contractorReviewCount={offer.contractor?.rating_count ?? null}
              contractorVerified={Boolean(offer.contractor?.verified)}
              contractorBio={offer.contractor?.bio ?? null}
              typicalRangeMin={Number(offer.amount) * 0.85}
              typicalRangeMax={Number(offer.amount) * 1.1}
              aiEstimateMin={project.ai_estimate_min}
              aiEstimateMax={project.ai_estimate_max}
              variant="secondary"
              label={offer.status === 'expired' ? 'Create again' : 'Counter'}
              className="h-9 rounded-xl px-3 text-xs font-black"
            />
          )}

          <OfferActions
            offerId={offer.id}
            projectId={project.id}
            status={offer.status}
            isAwarded={isWinner}
            projectStatus={status}
            senderRole={offer.sender_role}
          />
        </div>
      </aside>
    </article>
  );
}

function HistoryRow({
  offer,
  contractor,
  selectedOfferId,
}: {
  offer: OfferRow;
  contractor: ContractorProfile | null;
  selectedOfferId: string | null;
}) {
  const company = contractor?.company_name ?? 'Contractor';
  const isWinner = selectedOfferId === offer.id;

  return (
    <article className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_140px_120px_120px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-black text-[#0f172a]">
            {offer.sender_role === 'homeowner' ? `Your offer to ${company}` : company}
          </h3>

          {isWinner && <Badge tone="success">Selected</Badge>}
          <OfferStatusBadge status={offer.status} />
        </div>

        <p className="mt-1 text-xs font-semibold text-slate-500">
          {offer.kind ? readableStatus(offer.kind) : 'Offer'}
          {offer.created_at ? ` · ${relativeTime(offer.created_at)}` : ''}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          Amount
        </p>
        <p className="text-sm font-black text-[#0f172a]">
          {formatCurrency(Number(offer.amount))}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          Timeline
        </p>
        <p className="text-sm font-black text-[#0f172a]">
          {offer.timeline_days ? `${offer.timeline_days}d` : 'TBD'}
        </p>
      </div>

      <div className="text-right">
        <OfferStatusBadge status={offer.status} />
      </div>
    </article>
  );
}

function EmptyOffers({ projectId }: { projectId: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <h3 className="text-base font-black text-[#0f172a]">
        No offers yet
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Send a structured budget request to contractors or wait for contractors
        to send offers.
      </p>

      <Link
        href="/dashboard/contractors"
        className="mt-5 inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-[#0f172a] transition hover:bg-slate-50"
      >
        Browse contractors
      </Link>
    </div>
  );
}

function ScopeBox({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string;
  items: string[];
  emptyText: string;
  tone: 'included' | 'excluded' | 'notes';
}) {
  const config = {
    included: {
      mark: '✓',
      box: 'border-emerald-200 bg-emerald-50/70',
      title: 'text-emerald-700',
      badge: 'bg-emerald-600 text-white',
    },
    excluded: {
      mark: '–',
      box: 'border-rose-200 bg-rose-50/70',
      title: 'text-rose-700',
      badge: 'bg-rose-600 text-white',
    },
    notes: {
      mark: '•',
      box: 'border-slate-200 bg-slate-50',
      title: 'text-slate-600',
      badge: 'bg-slate-500 text-white',
    },
  }[tone];

  return (
    <section className={`rounded-lg border p-3 ${config.box}`}>
      <div
        className={`text-[11px] font-black uppercase tracking-wide ${config.title}`}
      >
        {title}
      </div>

      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-slate-500">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm leading-5 text-slate-800">
          {items.slice(0, 4).map((item, index) => (
            <li key={`${title}-${index}`} className="flex gap-2">
              <span
                className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-black ${config.badge}`}
              >
                {config.mark}
              </span>

              <span>{item}</span>
            </li>
          ))}

          {items.length > 4 && (
            <li className="pl-6 text-xs font-black text-slate-400">
              +{items.length - 4} more
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function PlatformRulesBox() {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
      <div className="text-xs font-black uppercase tracking-wide text-amber-800">
        Marketplace safety rule
      </div>

      <p className="mt-1 text-sm leading-6 text-amber-950/80">
        Keep negotiation, scope changes and payments inside bidAI. External
        phone numbers, emails, social media accounts, payment links or direct
        payment instructions should not be shared before checkout.
      </p>
    </section>
  );
}

function NoticeBox({
  tone,
  title,
  text,
}: {
  tone: 'danger' | 'neutral';
  title: string;
  text: string;
}) {
  const className =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-900'
      : 'border-slate-200 bg-white text-slate-600';

  return (
    <section className={`rounded-lg border p-4 shadow-sm ${className}`}>
      <div className="text-xs font-black uppercase tracking-wide">
        {title}
      </div>

      <p className="mt-2 text-sm leading-6 opacity-80">
        {text}
      </p>
    </section>
  );
}

function buildLatestDisplayOffers(
  offers: OfferRow[],
  contractorById: Map<string, ContractorProfile>,
): DisplayOffer[] {
  const latestByThread = new Map<string, DisplayOffer>();

  for (const offer of offers) {
    const contractorId = getContractorIdFromOffer(offer);
    const contractor = contractorId ? contractorById.get(contractorId) ?? null : null;
    const threadKey = getOfferThreadKey(offer, contractorId);

    const displayOffer: DisplayOffer = {
      ...offer,
      contractorId,
      contractor,
      threadKey,
    };

    const current = latestByThread.get(threadKey);

    if (!current) {
      latestByThread.set(threadKey, displayOffer);
      continue;
    }

    const currentTime = new Date(current.created_at).getTime();
    const nextTime = new Date(offer.created_at).getTime();

    if (nextTime > currentTime) {
      latestByThread.set(threadKey, displayOffer);
    }
  }

  return Array.from(latestByThread.values()).sort((a, b) => {
    const aTurn = isHomeownerTurn(a) ? 1 : 0;
    const bTurn = isHomeownerTurn(b) ? 1 : 0;

    if (aTurn !== bTurn) return bTurn - aTurn;

    const aPriority = statusPriority(a.status);
    const bPriority = statusPriority(b.status);

    if (aPriority !== bPriority) return aPriority - bPriority;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function getOfferThreadKey(
  offer: OfferRow,
  contractorId: string | null,
): string {
  if (offer.conversation_id) return `conversation:${offer.conversation_id}`;

  return `project:${offer.project_id}:contractor:${contractorId ?? offer.sender_id}`;
}

function isHomeownerTurn(offer: OfferRow): boolean {
  return (
    ['pending', 'countered'].includes(offer.status) &&
    offer.sender_role === 'contractor'
  );
}

function normalizeOfferScope(offer: OfferRow): {
  included: string[];
  excluded: string[];
  notes: string[];
} {
  const parsedMessage = parseOfferJsonMessage(offer.message);
  const parsedScope = parseScopeSummary(offer.scope_summary);

  const includedFromColumn = normalizeItems(offer.included_items);
  const excludedFromColumn = normalizeItems(offer.excluded_items);
  const notesFromColumn = normalizeItems(offer.notes);

  return {
    included:
      includedFromColumn.length > 0
        ? includedFromColumn
        : parsedMessage.included.length > 0
          ? parsedMessage.included
          : parsedScope.included,

    excluded:
      excludedFromColumn.length > 0
        ? excludedFromColumn
        : parsedMessage.excluded.length > 0
          ? parsedMessage.excluded
          : parsedScope.excluded,

    notes:
      notesFromColumn.length > 0
        ? notesFromColumn
        : parsedMessage.message
          ? [parsedMessage.message]
          : [],
  };
}

function parseOfferJsonMessage(message?: string | null): {
  message: string | null;
  included: string[];
  excluded: string[];
} {
  if (!message) {
    return {
      message: null,
      included: [],
      excluded: [],
    };
  }

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
    return {
      message,
      included: [],
      excluded: [],
    };
  }
}

function parseScopeSummary(scopeSummary?: string | null): {
  included: string[];
  excluded: string[];
} {
  if (!scopeSummary) {
    return {
      included: [],
      excluded: [],
    };
  }

  const lines = scopeSummary
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const included: string[] = [];
  const excluded: string[] = [];

  let mode: 'included' | 'excluded' | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (lower.startsWith('included')) {
      mode = 'included';
      continue;
    }

    if (lower.startsWith('excluded')) {
      mode = 'excluded';
      continue;
    }

    const cleaned = line.replace(/^[-•]\s*/, '').trim();

    if (!cleaned) continue;

    if (mode === 'included') included.push(cleaned);
    if (mode === 'excluded') excluded.push(cleaned);
  }

  return {
    included,
    excluded,
  };
}

function normalizeItems(value: string[] | string | null | undefined): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value)
    .split(/\n|,|;|•/)
    .map((item) => item.replace(/^[-–—]\s*/, '').trim())
    .filter(Boolean)
    .filter((item) => {
      const lowered = item.toLowerCase();

      return ![
        'not specified',
        'no exclusions listed',
        'no additional notes',
      ].includes(lowered);
    });
}

function ProjectStatusBadge({ status }: { status: string }) {
  if (status === 'pending_payment') {
    return <Badge tone="warning">Payment pending</Badge>;
  }

  if (status === 'paid') {
    return <Badge tone="warning">Awaiting contractor</Badge>;
  }

  if (status === 'in_progress') {
    return <Badge tone="success">In progress</Badge>;
  }

  if (status === 'completed') {
    return <Badge tone="success">Completed</Badge>;
  }

  if (status === 'cancelled') {
    return <Badge tone="default">Cancelled</Badge>;
  }

  if (status === 'expired') {
    return <Badge tone="default">Expired</Badge>;
  }

  if (status === 'open') {
    return <Badge tone="brand">Open</Badge>;
  }

  if (status === 'in_review' || status === 'quoted' || status === 'negotiating') {
    return <Badge tone="warning">Negotiating</Badge>;
  }

  return <Badge tone="brand">{readableStatus(status)}</Badge>;
}

function OfferStatusBadge({ status }: { status: string }) {
  if (status === 'pending') {
    return <Badge tone="warning">Pending</Badge>;
  }

  if (status === 'countered') {
    return <Badge tone="warning">Countered</Badge>;
  }

  if (status === 'payment_pending') {
    return <Badge tone="warning">Payment pending</Badge>;
  }

  if (status === 'accepted') {
    return <Badge tone="success">Accepted</Badge>;
  }

  if (status === 'rejected') {
    return <Badge tone="default">Rejected</Badge>;
  }

  if (status === 'expired') {
    return <Badge tone="default">Expired</Badge>;
  }

  if (status === 'withdrawn') {
    return <Badge tone="default">Withdrawn</Badge>;
  }

  return <Badge tone="brand">{readableStatus(status)}</Badge>;
}

function statusPriority(status: string): number {
  if (status === 'pending' || status === 'countered') return 1;
  if (status === 'payment_pending') return 2;
  if (status === 'accepted') return 3;
  if (status === 'expired') return 4;
  if (status === 'rejected' || status === 'withdrawn') return 5;
  return 10;
}

function getContractorIdFromOffer(offer: OfferRow): string | null {
  if (offer.sender_role === 'contractor') return offer.sender_id;
  if (offer.recipient_role === 'contractor') return offer.recipient_id;
  return null;
}

function readableStatus(value: string): string {
  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}