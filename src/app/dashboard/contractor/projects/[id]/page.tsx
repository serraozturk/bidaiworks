import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatRange, relativeTime } from '@/lib/utils';
import { commitmentFee } from '@/lib/fees';
import { getProjectRiskWarnings } from '@/lib/projectRiskWarnings';
import { SupportDisputePanel } from '@/components/SupportDisputePanel';
import OfferForm from './offer-form';

interface Params {
  params: {
    id: string;
  };
  searchParams?: {
    returnTo?: string;
    offerMode?: string;
    committed?: string;
    dispute_raised?: string;
    dispute_error?: string;
    dispute_exists?: string;
  };
}

const NEGOTIATION_PROJECT_STATUSES = [
  'open',
  'quoted',
  'negotiating',
  'in_review',
  'expired',
];

export default async function ContractorProjectDetail({
  params,
  searchParams,
}: Params) {
  const returnTo = searchParams?.returnTo;
  const offerMode = searchParams?.offerMode;
  const forceNewOffer = offerMode === 'new';

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Recover any stale payment / commitment windows before rendering.
  await supabase.rpc('expire_stale_deals').then(() => undefined, () => undefined);

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select(`
      id,
      title,
      description,
      zip_code,
      city,
      state,
      square_footage,
      quality_level,
      project_scope,
      material_preferences,
      property_type,
      homeowner_readiness,
      desired_start_timing,
      desired_completion_timing,
      access_notes,
      measurement_notes,
      ai_estimate_min,
      ai_estimate_max,
      budget_min,
      budget_max,
      status,
      payment_status,
      awarded_offer_id,
      contractor_fee_status,
      contractor_fee_amount,
      contractor_commit_due_at,
      paid_at,
      photos_complete,
      brief_complete,
      created_at,
      homeowner_id,
      categories(name, slug),
      project_photos(id, url, caption, position),
      project_answers(id, question_key, question_label, answer_value),
      project_required_photos(id, photo_key, photo_label, photo_description, image_url, is_required, uploaded_at),
      project_material_preferences(id, item_key, item_label, preferred_quality, preferred_material, preferred_brand, custom_note, zip_based_suggestion),
      profiles!projects_homeowner_id_fkey(full_name)
    `)
    .eq('id', params.id)
    .single();

  if (projectError) {
    console.error('Contractor project detail query error:', projectError);
    throw new Error(projectError.message);
  }

  if (!project) notFound();

  const { data: existingOffer, error: offerError } = await supabase
    .from('offers')
    .select(`
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
      included_scope,
      excluded_scope,
      material_allowance,
      assumptions,
      risk_notes,
      warranty,
      offer_type,
      earliest_start_date,
      materials_included,
      labor_included,
      cleanup_included,
      permits_included,
      site_visit_required,
      notes,
      message,
      contractor_fee_amount,
      contractor_fee_status,
      created_at
    `)
    .eq('project_id', project.id)
    .eq('sender_id', user.id)
    .eq('sender_role', 'contractor')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (offerError) {
    console.error('Existing contractor offer query error:', offerError);
    throw new Error(offerError.message);
  }

  const offerScope = normalizeOfferScope(existingOffer);
  const latestOfferExpired = existingOffer?.status === 'expired';

  const projectAcceptsFreshOffer = NEGOTIATION_PROJECT_STATUSES.includes(
    project.status,
  );

  const canSubmitOffer =
    projectAcceptsFreshOffer &&
    (!existingOffer || latestOfferExpired || forceNewOffer);

  const shouldShowExistingOffer =
    existingOffer && !latestOfferExpired && !forceNewOffer;

  const photos = ((project.project_photos ?? []) as any[]).sort(
    (a, b) => Number(a.position ?? 0) - Number(b.position ?? 0),
  );

  const homeownerName =
    firstRow<any>(project.profiles)?.full_name ?? 'Homeowner';

  // Did this contractor win the deal?
  const isAwardedContractor =
    existingOffer?.status === 'accepted' &&
    (!project.awarded_offer_id || project.awarded_offer_id === existingOffer.id);

  // Homeowner has paid; this contractor must pay the 8% commitment fee.
  const isAwaitingMyCommitment =
    project.status === 'paid' &&
    project.contractor_fee_status === 'due' &&
    isAwardedContractor;

  const isMyActiveJob = project.status === 'in_progress' && isAwardedContractor;
  const justCommitted = searchParams?.committed === '1';

  const commitDueAt = project.contractor_commit_due_at
    ? new Date(project.contractor_commit_due_at)
    : null;
  const commitHoursLeft = commitDueAt
    ? Math.max(0, Math.ceil((commitDueAt.getTime() - Date.now()) / 3600000))
    : null;

  const myCommitmentFee =
    project.contractor_fee_amount != null
      ? Number(project.contractor_fee_amount)
      : commitmentFee(Number(existingOffer?.amount ?? 0));

  // What can this contractor reliably price from, given there is no chat
  // before checkout? Surface the gaps + risks so they price defensively.
  const riskWarnings = getProjectRiskWarnings({
    project: project as any,
    answers: (project.project_answers ?? []) as any,
    requiredPhotos: (project.project_required_photos ?? []) as any,
  });
  const briefLooksClean =
    riskWarnings.length === 1 && riskWarnings[0].startsWith('No major');

  const { data: disputeRows } = await supabase
    .from('disputes')
    .select(
      'id, status, category, priority, requested_resolution, reason, admin_note, resolution, created_at, resolved_at',
    )
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 py-5 text-[#0f172a]">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={returnTo || '/dashboard/contractor'}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#0f172a]"
          >
            {returnTo ? '← Back to messages' : '← Back to leads'}
          </Link>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/contractor/offers"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Offer pipeline
            </Link>

            <Link
              href={`/dashboard/messages/${project.id}/${project.homeowner_id}`}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#f45112] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#d94406]"
            >
              Deal room
            </Link>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-white px-6 py-7 text-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-3xl font-black tracking-tight text-slate-900">
                    {project.title}
                  </h1>

                  <ProjectStatusBadge status={project.status} />
                </div>

                <p className="mt-2 text-sm font-semibold text-slate-600">
                  {categoryName(project.categories) ?? 'Renovation'}
                  {project.zip_code ? ` · ZIP ${project.zip_code}` : ''}
                  {project.city ? ` · ${project.city}` : ''}
                  {project.state ? `, ${project.state}` : ''}
                  {' · posted '}
                  {relativeTime(project.created_at)}
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-400">
                  Homeowner: {homeownerName}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-right">
                <div className="text-[11px] font-black uppercase tracking-wide text-[#f45112]">
                  Homeowner budget
                </div>

                <div className="mt-1 text-2xl font-black text-slate-900">
                  {formatRange(project.budget_min, project.budget_max)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_440px]">
            <section className="border-b border-slate-100 p-5 xl:border-b-0 xl:border-r">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <MiniStat
                  label="AI estimate"
                  value={formatRange(
                    project.ai_estimate_min,
                    project.ai_estimate_max,
                  )}
                />

                <MiniStat
                  label="Size"
                  value={
                    project.square_footage
                      ? `${project.square_footage} sq ft`
                      : 'Not specified'
                  }
                />

                <MiniStat
                  label="Budget"
                  value={formatRange(project.budget_min, project.budget_max)}
                />

                <MiniStat
                  label="Readiness"
                  value={project.homeowner_readiness || 'Not specified'}
                />

                <MiniStat
                  label="Start"
                  value={project.desired_start_timing || 'Not specified'}
                />

                <MiniStat
                  label="Payment"
                  value={readableStatus(project.payment_status ?? 'unpaid')}
                />
              </div>

              <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-sm font-black">Project description</h2>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {project.description || 'No description provided.'}
                </p>
              </section>

              <PricingRiskPanel
                warnings={riskWarnings}
                clean={briefLooksClean}
                briefComplete={Boolean(project.brief_complete)}
                photosComplete={Boolean(project.photos_complete)}
              />

              <ProjectBriefSection project={project} />

              <ProjectRequiredPhotosSection project={project} />

              {photos.length > 0 && (
                <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-black">Additional project photos</h2>

                    <span className="text-xs font-bold text-slate-500">
                      {photos.length} photo{photos.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {photos.map((photo: any) => (
                      <a
                        key={photo.id}
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={photo.caption ?? 'Project photo'}
                          className="h-32 w-full object-cover transition hover:scale-105"
                        />

                        {photo.caption && (
                          <div className="border-t border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500">
                            {photo.caption}
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </section>

            <aside className="p-5">
              <div className="sticky top-5 space-y-4">
                {justCommitted && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                    Commitment fee paid. This job is now active and direct chat
                    is open.
                  </div>
                )}

                {searchParams?.dispute_raised === '1' && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                    Dispute opened. bidAI support will review the project, offer,
                    payment and message history.
                  </div>
                )}

                {searchParams?.dispute_exists === '1' && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                    This project already has an active dispute.
                  </div>
                )}

                {searchParams?.dispute_error === '1' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    Could not open dispute. Add a reason and try again.
                  </div>
                )}

                <SupportDisputePanel
                  projectId={project.id}
                  projectStatus={project.status}
                  role="contractor"
                  backTo={`/dashboard/contractor/projects/${project.id}`}
                  disputes={(disputeRows ?? []) as any[]}
                />

                {isAwaitingMyCommitment && (
                  <section className="rounded-lg border border-orange-300 bg-orange-50 p-5 shadow-sm">
                    <div className="text-xs font-black uppercase tracking-wide text-orange-700">
                      Claim this job
                    </div>

                    <h2 className="mt-1 text-lg font-black text-orange-950">
                      Pay your commitment fee
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-orange-900/80">
                      The homeowner has paid and the funds are held in escrow.
                      Pay the {formatCurrency(myCommitmentFee)} commitment fee to
                      confirm this job, unlock direct chat and start work.
                      {commitHoursLeft != null
                        ? ` About ${commitHoursLeft} hour${
                            commitHoursLeft === 1 ? '' : 's'
                          } left before it re-opens to other contractors.`
                        : ''}
                    </p>

                    <Link
                      href={`/dashboard/contractor/jobs/${project.id}/commit`}
                      className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#f45112] px-4 text-sm font-black text-white transition hover:bg-[#d94406]"
                    >
                      Pay {formatCurrency(myCommitmentFee)} commitment fee
                    </Link>
                  </section>
                )}

                {isMyActiveJob && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                    You have committed to this job - it is active and in your
                    active jobs list.
                  </div>
                )}

                {shouldShowExistingOffer ? (
                  <OfferSummary
                    offer={existingOffer}
                    scope={offerScope}
                    project={project}
                  />
                ) : canSubmitOffer ? (
                  <section>
                    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <h2 className="text-base font-black">
                        {latestOfferExpired || forceNewOffer
                          ? 'Create a fresh detailed offer'
                          : 'Send a detailed offer'}
                      </h2>

                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {latestOfferExpired || forceNewOffer
                          ? 'The previous offer expired. Send a fresh price, timeline, included work, exclusions, material allowance and assumptions.'
                          : 'Homeowners compare amount, timeline, included work, exclusions, material allowance, assumptions, risk notes and warranty side by side.'}
                      </p>
                    </div>

                    {latestOfferExpired && existingOffer && (
                      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                        <div className="text-xs font-black uppercase tracking-wide text-red-700">
                          Previous offer expired
                        </div>

                        <p className="mt-1 text-sm leading-6 text-red-900/80">
                          Your last offer was{' '}
                          {formatCurrency(Number(existingOffer.amount))}. You can
                          send a new offer to restart negotiation.
                        </p>
                      </div>
                    )}

                    <OfferForm
                      projectId={project.id}
                      contractorId={user.id}
                      homeownerId={project.homeowner_id}
                    />
                  </section>
                ) : (
                  <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                    <h2 className="text-sm font-black">Offer unavailable</h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      This project is no longer accepting new offers.
                    </p>
                  </section>
                )}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function PricingRiskPanel({
  warnings,
  clean,
  briefComplete,
  photosComplete,
}: {
  warnings: string[];
  clean: boolean;
  briefComplete: boolean;
  photosComplete: boolean;
}) {
  return (
    <section
      className={[
        'mt-5 rounded-lg border p-5 shadow-sm',
        clean ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div
            className={[
              'text-xs font-black uppercase tracking-wide',
              clean ? 'text-emerald-700' : 'text-amber-800',
            ].join(' ')}
          >
            Before you price this job
          </div>

          <h2 className="mt-1 text-base font-black text-[#0f172a]">
            {clean
              ? 'This brief looks well specified'
              : 'Price defensively - review these first'}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusPill
            label={briefComplete ? 'Brief complete' : 'Brief incomplete'}
            tone={briefComplete ? 'success' : 'warning'}
          />

          <StatusPill
            label={photosComplete ? 'Photos complete' : 'Photos incomplete'}
            tone={photosComplete ? 'success' : 'warning'}
          />
        </div>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        You cannot message the homeowner until the job is paid and confirmed,
        so anything unclear below should be written into your offer as an
        assumption, exclusion or material allowance.
      </p>

      <ul className="mt-3 space-y-2">
        {warnings.map((warning, index) => (
          <li
            key={index}
            className="flex gap-2.5 rounded-lg border border-white bg-white/70 px-3 py-2.5"
          >
            <span
              className={[
                'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black',
                clean ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white',
              ].join(' ')}
            >
              {clean ? 'OK' : '!'}
            </span>

            <span className="text-sm leading-6 text-slate-700">{warning}</span>
          </li>
        ))}
      </ul>

      {!clean && (
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold leading-5 text-amber-900">
          Tip: pick the &quot;Estimate based on provided details&quot; or &quot;Final
          after site visit&quot; offer type when the brief leaves room for surprises.
        </p>
      )}
    </section>
  );
}

function ProjectBriefSection({ project }: { project: any }) {
  const answers = Array.isArray(project.project_answers)
    ? project.project_answers
    : [];

  const materials = Array.isArray(project.project_material_preferences)
    ? project.project_material_preferences
    : [];

  return (
    <section className="mt-5 space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black">Contractor-ready brief</h2>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              The homeowner cannot chat before checkout. Review every answer,
              measurement, access note, material preference and required photo before pricing.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill
              label={project.brief_complete ? 'Brief complete' : 'Brief incomplete'}
              tone={project.brief_complete ? 'success' : 'warning'}
            />

            <StatusPill
              label={project.photos_complete ? 'Photos complete' : 'Photos incomplete'}
              tone={project.photos_complete ? 'success' : 'warning'}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <DetailPill
            label="Project scope"
            value={readableStatus(project.project_scope || '')}
          />

          <DetailPill
            label="Quality level"
            value={readableStatus(project.quality_level || '')}
          />

          <DetailPill
            label="Property type"
            value={project.property_type || 'Not specified'}
          />

          <DetailPill
            label="Homeowner readiness"
            value={project.homeowner_readiness || 'Not specified'}
          />

          <DetailPill
            label="Desired start"
            value={project.desired_start_timing || 'Not specified'}
          />

          <DetailPill
            label="Desired completion"
            value={project.desired_completion_timing || 'Not specified'}
          />
        </div>

        {project.measurement_notes && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
              Measurements / dimensions
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {project.measurement_notes}
            </p>
          </div>
        )}

        {project.access_notes && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
              Access / parking / HOA / building rules
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {project.access_notes}
            </p>
          </div>
        )}
      </div>

      {answers.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-black">Detailed homeowner answers</h2>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            These answers come from the category-specific project brief form.
          </p>

          <div className="mt-4 grid gap-3">
            {answers.map((answer: any) => (
              <div
                key={answer.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="text-xs font-black text-slate-500">
                  {answer.question_label}
                </div>

                <div className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-[#0f172a]">
                  {formatAnswerValue(answer.answer_value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {materials.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-black">Material and product preferences</h2>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Use these preferences when creating material allowance and exclusions.
            Prices may vary by ZIP, availability, selected brand and quality level.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {materials.map((item: any) => (
              <div
                key={item.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-[#0f172a]">
                    {item.item_label}
                  </h3>

                  {item.preferred_quality && (
                    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-black text-orange-700">
                      {item.preferred_quality}
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <Line label="Material" value={item.preferred_material} />
                  <Line label="Brand / store" value={item.preferred_brand} />
                  <Line label="Note" value={item.custom_note} />
                </div>

                {item.zip_based_suggestion && (
                  <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2">
                    <div className="text-[11px] font-black uppercase tracking-wide text-orange-700">
                      ZIP-based guidance
                    </div>

                    <p className="mt-1 text-xs leading-5 text-orange-950/80">
                      {formatZipSuggestion(item.zip_based_suggestion)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ProjectRequiredPhotosSection({ project }: { project: any }) {
  const requiredPhotos = Array.isArray(project.project_required_photos)
    ? project.project_required_photos
    : [];

  if (requiredPhotos.length === 0) return null;

  const uploadedCount = requiredPhotos.filter((p: any) => p.image_url).length;

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black">Required project photos</h2>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            These are the required angles requested from the homeowner for this category.
            Open each image before pricing the job.
          </p>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
          {uploadedCount}/{requiredPhotos.length} uploaded
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {requiredPhotos.map((photo: any) => (
          <div
            key={photo.id}
            className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
          >
            {photo.image_url ? (
              <a href={photo.image_url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.image_url}
                  alt={photo.photo_label}
                  className="h-40 w-full object-cover transition hover:scale-105"
                />
              </a>
            ) : (
              <div className="grid h-40 place-items-center bg-red-50 px-4 text-center text-xs font-black text-red-700">
                Missing required photo
              </div>
            )}

            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-black text-[#0f172a]">
                  {photo.photo_label}
                </div>

                {photo.image_url ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                    OK
                  </span>
                ) : (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-700">
                    Missing
                  </span>
                )}
              </div>

              {photo.photo_description && (
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {photo.photo_description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OfferSummary({
  offer,
  scope,
  project,
}: {
  offer: any;
  scope: {
    included: string[];
    excluded: string[];
    notes: string[];
  };
  project: any;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-black">Your latest offer</h2>

          <Badge tone={offerTone(offer.status)}>
            {readableStatus(offer.status)}
          </Badge>
        </div>

        <div className="mt-3 text-3xl font-black tracking-tight">
          {formatCurrency(Number(offer.amount))}
        </div>

        <p className="mt-1 text-xs font-semibold text-slate-500">
          {offer.timeline_days
            ? `${offer.timeline_days} day timeline`
            : 'Timeline TBD'}
          {' · '}
          sent {relativeTime(offer.created_at)}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-bold text-slate-500">
            Contractor commitment fee
          </span>

          <span className="font-black text-[#0f172a]">
            {formatCurrency(
              Number(offer.contractor_fee_amount ?? commitmentFee(Number(offer.amount))),
            )}
          </span>
        </div>

        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          8% of the offer. You pay this to claim the job after the homeowner
          completes checkout.
        </p>
      </div>

      <ScopeList
        title="Included"
        items={scope.included}
        emptyText="No included items saved."
        type="included"
      />

      <ScopeList
        title="Excluded"
        items={scope.excluded}
        emptyText="No exclusions listed."
        type="excluded"
      />

      <OfferConditionSummary offer={offer} />

      <ScopeList
        title="Notes"
        items={scope.notes}
        emptyText="No additional notes."
        type="notes"
      />

      <div className="grid gap-2">
        <Link
          href={`/dashboard/messages/${project.id}/${project.homeowner_id}`}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#f45112] px-3 text-sm font-black text-white transition hover:bg-[#d94406]"
        >
          Open deal room
        </Link>

        <Link
          href="/dashboard/contractor/offers"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
        >
          View offer pipeline
        </Link>

        {['expired', 'rejected', 'withdrawn'].includes(offer.status) && (
          <Link
            href={`/dashboard/contractor/projects/${project.id}?offerMode=new`}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[#f4510b] px-3 text-sm font-black text-white transition hover:bg-[#d94406]"
          >
            Create fresh offer
          </Link>
        )}
      </div>
    </section>
  );
}

function OfferConditionSummary({ offer }: { offer: any }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
        Offer conditions
      </div>

      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
        <Line label="Offer type" value={readableOfferType(offer.offer_type)} />
        <Line label="Earliest start" value={offer.earliest_start_date} />
        <Line label="Material allowance" value={offer.material_allowance} />
        <Line label="Assumptions" value={offer.assumptions} />
        <Line label="Risk notes" value={offer.risk_notes} />
        <Line label="Warranty" value={offer.warranty} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <BooleanPill label="Labor included" value={offer.labor_included} />
        <BooleanPill label="Materials included" value={offer.materials_included} />
        <BooleanPill label="Cleanup included" value={offer.cleanup_included} />
        <BooleanPill label="Permits included" value={offer.permits_included} />
        <BooleanPill label="Site visit required" value={offer.site_visit_required} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-sm font-black text-[#0f172a]">
        {value || 'Not specified'}
      </div>
    </div>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-sm font-black text-[#0f172a]">
        {value || 'Not specified'}
      </div>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'warning';
}) {
  const className =
    tone === 'success'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-amber-50 text-amber-700';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${className}`}>
      {label}
    </span>
  );
}

function ScopeList({
  title,
  items,
  emptyText,
  type,
}: {
  title: string;
  items: string[];
  emptyText: string;
  type: 'included' | 'excluded' | 'notes';
}) {
  const mark = type === 'included' ? '✓' : type === 'excluded' ? '–' : '•';

  const tone =
    type === 'included'
      ? 'bg-emerald-50 text-emerald-700'
      : type === 'excluded'
        ? 'bg-rose-50 text-rose-700'
        : 'bg-slate-100 text-slate-600';

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
        {title}
      </div>

      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-slate-500">{emptyText}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((item, index) => (
            <li
              key={`${title}-${index}`}
              className="flex gap-2 text-sm leading-5 text-slate-700"
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black ${tone}`}
              >
                {mark}
              </span>

              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BooleanPill({
  label,
  value,
}: {
  label: string;
  value: boolean | null | undefined;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-xs font-black text-[#0f172a]">
        {value ? 'Yes' : 'No'}
      </div>
    </div>
  );
}

function Line({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;

  return (
    <div>
      <span className="font-black text-slate-500">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

function normalizeOfferScope(offer: any): {
  included: string[];
  excluded: string[];
  notes: string[];
} {
  if (!offer) {
    return {
      included: [],
      excluded: [],
      notes: [],
    };
  }

  const parsedMessage = parseOfferJsonMessage(offer.message);
  const parsedScope = parseScopeSummary(offer.scope_summary);

  const includedFromColumn = normalizeItems(
    offer.included_items || offer.included_scope,
  );

  const excludedFromColumn = normalizeItems(
    offer.excluded_items || offer.excluded_scope,
  );

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

  let mode:
    | 'included'
    | 'excluded'
    | 'material'
    | 'assumptions'
    | 'risk'
    | 'warranty'
    | 'notes'
    | null = null;

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

    if (lower.startsWith('material allowance')) {
      mode = 'material';
      continue;
    }

    if (lower.startsWith('assumptions')) {
      mode = 'assumptions';
      continue;
    }

    if (lower.startsWith('risk notes')) {
      mode = 'risk';
      continue;
    }

    if (lower.startsWith('warranty')) {
      mode = 'warranty';
      continue;
    }

    if (lower.startsWith('notes')) {
      mode = 'notes';
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
        'no material allowance listed',
        'no assumptions listed',
        'no risk notes listed',
        'no warranty listed',
      ].includes(lowered);
    });
}

function formatAnswerValue(value: any): string {
  if (value === null || value === undefined) return 'Not answered';

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : 'Not answered';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function formatZipSuggestion(value: any): string {
  if (!value) return 'No ZIP guidance available.';

  const suggestions = Array.isArray(value.suggestions)
    ? value.suggestions.join(', ')
    : '';

  const region = value.regionLabel ? `${value.regionLabel}: ` : '';
  const note = value.note ? `${value.note}` : '';

  return [region + suggestions, note].filter(Boolean).join(' · ');
}

function offerTone(status: string): 'success' | 'warning' | 'default' | 'brand' {
  if (status === 'accepted' || status === 'paid') return 'success';
  if (status === 'payment_pending') return 'warning';
  if (status === 'rejected' || status === 'expired' || status === 'cancelled') {
    return 'default';
  }
  if (status === 'countered') return 'brand';

  return 'warning';
}

function readableStatus(status: string): string {
  if (!status) return 'Unknown';
  if (status === 'payment_pending') return 'Payment pending';

  return status
    .replaceAll('_', ' ')
    .replace(/^./, (char) => char.toUpperCase());
}

function readableOfferType(value?: string | null) {
  if (!value) return 'Not specified';
  if (value === 'fixed_price') return 'Fixed price';
  if (value === 'estimate_based_on_details') {
    return 'Estimate based on provided details';
  }
  if (value === 'final_after_site_visit') return 'Final after site visit';
  if (value === 'labor_only') return 'Labor only';
  if (value === 'labor_and_materials') return 'Labor + materials';

  return readableStatus(value);
}

function ProjectStatusBadge({ status }: { status: string }) {
  const config =
    status === 'paid'
      ? {
          label: 'Homeowner paid - claim job',
          className: 'bg-orange-100 text-orange-700',
        }
      : status === 'in_progress'
        ? {
            label: 'In progress',
            className: 'bg-emerald-100 text-emerald-700',
          }
        : status === 'completed'
          ? {
              label: 'Completed',
              className: 'bg-slate-200 text-slate-700',
            }
          : status === 'open'
            ? {
                label: 'Open',
                className: 'bg-blue-100 text-blue-700',
              }
            : status === 'quoted'
              ? {
                  label: 'Quoted',
                  className: 'bg-indigo-100 text-indigo-700',
                }
              : status === 'negotiating'
                ? {
                    label: 'Negotiating',
                    className: 'bg-amber-100 text-amber-800',
                  }
                : status === 'in_review'
                  ? {
                      label: 'In review',
                      className: 'bg-purple-100 text-purple-700',
                    }
                  : status === 'expired'
                    ? {
                        label: 'Expired',
                        className: 'bg-red-100 text-red-700',
                      }
                    : {
                        label: readableStatus(status),
                        className: 'bg-slate-100 text-slate-700',
                      };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function categoryName(value: any): string | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    return value[0]?.name ?? null;
  }

  return value.name ?? null;
}

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}