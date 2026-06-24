import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AdminPageHeader, Panel, Pill, EmptyRow, StatCard, BackLink, formatWhen, money,
} from '@/components/admin/ui';
import { AdminActionButton } from '@/components/admin/AdminActionButton';
import { approveProject, refundProjectEscrow, rejectProject, releaseProjectEscrow } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

interface Params { params: { id: string } }

export default async function AdminProjectDetailPage({ params }: Params) {
  const db = createAdminClient();

  const { data: project } = await db.from('projects').select('*').eq('id', params.id).maybeSingle();
  if (!project) notFound();

  const [
    { data: homeowner },
    { data: category },
    { data: offers },
    { data: payments },
    { data: conversations },
    { data: events },
    { data: photos },
  ] = await Promise.all([
    db.from('profiles').select('id, full_name, phone, email').eq('id', project.homeowner_id).maybeSingle(),
    db.from('categories').select('name').eq('id', project.category_id).maybeSingle(),
    db.from('offers').select('id, sender_id, sender_role, recipient_id, recipient_role, amount, timeline_days, status, kind, notes, included_items, excluded_items, contractor_fee_amount, contractor_fee_percent, accepted_at, created_at').eq('project_id', project.id).order('created_at', { ascending: false }),
    db.from('payments').select('id, payer_id, payee_id, total_amount, project_amount, protection_hold_amount, contractor_fee_amount, contractor_payout_amount, status, created_at').eq('project_id', project.id),
    db.from('conversations').select('id, contractor_id, last_message_at, created_at').eq('project_id', project.id).order('last_message_at', { ascending: false }),
    db.from('marketplace_events').select('id, event_type, summary, created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(40),
    db.from('project_photos').select('id, url, caption, created_at').eq('project_id', project.id).order('created_at', { ascending: true }).limit(20),
  ]);

  // Also fetch required photos (newer upload flow uses project_required_photos.image_url)
  const { data: requiredPhotos } = await db
    .from('project_required_photos')
    .select('id, image_url, photo_label, uploaded_at')
    .eq('project_id', project.id)
    .not('image_url', 'is', null)
    .order('uploaded_at', { ascending: true })
    .limit(20);

  // Merge both photo sources into a unified list
  const allPhotos = [
    ...(photos ?? []).filter((p) => p.url).map((p) => ({ id: p.id, url: p.url as string, label: p.caption ?? 'Photo' })),
    ...(requiredPhotos ?? []).map((p) => ({ id: `req-${p.id}`, url: p.image_url as string, label: p.photo_label ?? 'Photo' })),
  ];

  // Fetch auth emails as fallback for users without full_name
  const { data: { users: authUsers } } = await db.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((authUsers ?? []).map((u: any) => [u.id, u.email as string]));

  const offerRows = offers ?? [];
  const paymentRows = payments ?? [];
  const eventRows = events ?? [];
  const photoRows = allPhotos;
  const conversationRows = conversations ?? [];

  // Fetch message counts per conversation
  const convIds = conversationRows.map((c) => c.id);
  const { data: messages } = convIds.length
    ? await db.from('messages').select('conversation_id').in('conversation_id', convIds)
    : { data: [] as any[] };
  const msgCount = new Map<string, number>();
  for (const m of messages ?? []) {
    msgCount.set(m.conversation_id, (msgCount.get(m.conversation_id) ?? 0) + 1);
  }

  const contractorIds = [
    ...new Set([
      ...offerRows.filter((o) => o.sender_role === 'contractor').map((o) => o.sender_id).filter(Boolean),
      ...conversationRows.map((c) => c.contractor_id).filter(Boolean),
    ]),
  ];

  const allUserIds = [
    ...new Set([
      ...contractorIds,
      ...paymentRows.map((p) => p.payer_id).filter(Boolean),
      ...paymentRows.map((p) => p.payee_id).filter(Boolean),
    ]),
  ];

  const [{ data: companies }, { data: allProfiles }] = await Promise.all([
    contractorIds.length
      ? db.from('contractor_profiles').select('user_id, company_name').in('user_id', contractorIds)
      : { data: [] as any[] },
    allUserIds.length
      ? db.from('profiles').select('id, full_name').in('id', allUserIds)
      : { data: [] as any[] },
  ]);

  const companyById = new Map((companies ?? []).map((c) => [c.user_id, c.company_name]));
  const profileById = new Map((allProfiles ?? []).map((p) => [p.id, p.full_name]));

  function displayName(userId: string | null | undefined): string {
    if (!userId) return '—';
    return companyById.get(userId) ?? profileById.get(userId) ?? emailById.get(userId) ?? userId.slice(0, 8);
  }

  const homeownerName = homeowner?.full_name ?? emailById.get(project.homeowner_id) ?? '—';

  const awardedOffer =
    offerRows.find((o) => o.id === project.awarded_offer_id) ??
    offerRows.find((o) => o.status === 'accepted');

  const awardedContractorId =
    awardedOffer?.sender_role === 'contractor'
      ? awardedOffer.sender_id
      : awardedOffer?.recipient_role === 'contractor'
      ? awardedOffer.recipient_id
      : null;

  const awardedContractorName = awardedContractorId
    ? companyById.get(awardedContractorId) ?? profileById.get(awardedContractorId) ?? emailById.get(awardedContractorId) ?? 'Contractor'
    : null;

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-6">
      <div className="mb-4">
        <BackLink href="/admin/projects" label="All projects" />
      </div>

      <AdminPageHeader
        eyebrow="Project"
        title={project.title}
        description={`${category?.name ?? 'Renovation'} · Homeowner: ${homeownerName}${awardedContractorName ? ` · Contractor: ${awardedContractorName}` : ''}`}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Pill value={project.status} />
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">Payment: {project.payment_status ?? '—'}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">Fee: {project.contractor_fee_status ?? 'none'}</span>
        {project.zip_code && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">ZIP {project.zip_code}</span>
        )}
        {awardedContractorName && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">Accepted by: {awardedContractorName}</span>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="AI estimate" value={money(project.ai_estimate_min)} hint={`to ${money(project.ai_estimate_max)}`} />
        <StatCard label="Agreed price" value={awardedOffer ? money(awardedOffer.amount) : '—'} tone="success" />
        <StatCard label="Conversations" value={conversationRows.length} />
        <StatCard label="Offers received" value={offerRows.length} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">

          {/* CONFIRMED CONTRACT */}
          {awardedOffer && (
            <Panel title="Confirmed contract (agreed deal)">
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3">
                    <div className="text-[10px] font-black uppercase tracking-wide text-emerald-600">Agreed price</div>
                    <div className="mt-1 text-xl font-black text-emerald-700">{money(awardedOffer.amount)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
                    <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Timeline</div>
                    <div className="mt-1 text-xl font-black text-slate-800">{awardedOffer.timeline_days ? `${awardedOffer.timeline_days} days` : '—'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
                    <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Platform fee</div>
                    <div className="mt-1 text-xl font-black text-slate-800">
                      {money(awardedOffer.contractor_fee_amount)}{awardedOffer.contractor_fee_percent ? ` (${awardedOffer.contractor_fee_percent}%)` : ''}
                    </div>
                  </div>
                </div>
                <dl className="divide-y divide-slate-100 text-sm">
                  <Row label="Contractor" value={awardedContractorName ?? '—'} />
                  <Row label="Homeowner" value={homeownerName} />
                  <Row label="Accepted at" value={formatWhen(awardedOffer.accepted_at)} />
                  <Row label="Offer status" value={<Pill value={awardedOffer.status} />} />
                </dl>
                {awardedOffer.notes && (
                  <div className="px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Notes</div>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{awardedOffer.notes}</p>
                  </div>
                )}
                {((awardedOffer.included_items?.length ?? 0) > 0 || (awardedOffer.excluded_items?.length ?? 0) > 0) && (
                  <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
                    {(awardedOffer.included_items?.length ?? 0) > 0 && (
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wide text-emerald-600">Included</div>
                        <ul className="mt-1 space-y-1">
                          {(awardedOffer.included_items as string[]).map((item, i) => (
                            <li key={i} className="text-sm text-slate-700">+ {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(awardedOffer.excluded_items?.length ?? 0) > 0 && (
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wide text-red-500">Excluded</div>
                        <ul className="mt-1 space-y-1">
                          {(awardedOffer.excluded_items as string[]).map((item, i) => (
                            <li key={i} className="text-sm text-slate-500">- {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {awardedContractorId && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <Link href={`/admin/contractors/${awardedContractorId}`} className="text-xs font-black text-orange-600 hover:underline">Open contractor profile</Link>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* PROJECT BRIEF */}
          <Panel title="Everything the homeowner entered">
            <p className="whitespace-pre-wrap px-4 py-3 text-sm leading-6 text-slate-600 border-b border-slate-100">
              {project.description || 'No description provided.'}
            </p>
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="Created" value={formatWhen(project.created_at)} />
              {project.street_address && <Row label="Street address" value={project.street_address} />}
              {project.city && <Row label="City / State" value={`${project.city}${project.state ? `, ${project.state}` : ''}`} />}
              <Row label="ZIP code" value={project.zip_code ?? '—'} />
              {project.square_footage && <Row label="Square footage" value={`${project.square_footage} sq ft`} />}
              {project.quality_level && (
                <Row label="Quality level" value={
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black capitalize ${
                    project.quality_level === 'premium' ? 'bg-violet-50 text-violet-700' :
                    project.quality_level === 'standard' ? 'bg-blue-50 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{String(project.quality_level).replace('_', ' ')}</span>
                } />
              )}
              {project.project_scope && (
                <Row label="Project scope" value={
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black capitalize text-slate-600">
                    {String(project.project_scope).replace('_', ' ')}
                  </span>
                } />
              )}
              {project.property_type && <Row label="Property type" value={String(project.property_type).replace('_', ' ')} />}
              {project.desired_start_timing && <Row label="Desired start" value={String(project.desired_start_timing).replace('_', ' ')} />}
              {project.desired_completion_timing && <Row label="Desired completion" value={String(project.desired_completion_timing).replace('_', ' ')} />}
              {project.desired_start_date && <Row label="Start date" value={formatWhen(project.desired_start_date)} />}
              {project.homeowner_readiness && <Row label="Homeowner readiness" value={String(project.homeowner_readiness).replace('_', ' ')} />}
              {(project.budget_min || project.budget_max) && (
                <Row label="Homeowner budget" value={
                  project.budget_min && project.budget_max
                    ? `${money(project.budget_min)} – ${money(project.budget_max)}`
                    : project.budget_min ? `From ${money(project.budget_min)}` : `Up to ${money(project.budget_max)}`
                } />
              )}
              {project.material_preferences && <Row label="Material preferences" value={project.material_preferences} />}
              {project.access_notes && <Row label="Access notes" value={project.access_notes} />}
              {project.measurement_notes && <Row label="Measurement notes" value={project.measurement_notes} />}
              <Row label="Paid at" value={formatWhen(project.paid_at)} />
              <Row label="Commitment due" value={formatWhen(project.contractor_commit_due_at)} />
              <Row label="Completed at" value={formatWhen(project.completed_at)} />
            </dl>
            {project.ai_estimate_reasoning && (
              <div className="border-t border-slate-100 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">AI estimate reasoning</div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{project.ai_estimate_reasoning}</p>
              </div>
            )}
          </Panel>

          {/* PROJECT PHOTOS */}
          {photoRows.length > 0 && (
            <Panel title={`Project photos (${photoRows.length})`}>
              <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
                {photoRows.map((photo) => (
                  <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer"
                    className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                    title={photo.label}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.label} className="h-full w-full object-cover transition group-hover:scale-105" />
                    <span className="absolute bottom-0 left-0 right-0 truncate bg-black/40 px-2 py-1 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                      {photo.label}
                    </span>
                  </a>
                ))}
              </div>
            </Panel>
          )}

          {/* ALL OFFERS */}
          <Panel title="All offers / negotiations" description={`${offerRows.length} offer(s) total`}>
            {offerRows.length === 0 ? (
              <EmptyRow>No offers on this project.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-100">
                {offerRows.map((offer) => {
                  const isAwarded = offer.id === awardedOffer?.id;
                  return (
                    <li key={offer.id} className={`px-4 py-3 ${isAwarded ? 'bg-emerald-50' : ''}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        {isAwarded && (
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">ACCEPTED CONTRACT</span>
                        )}
                        <span className="text-sm font-black text-slate-900">{money(offer.amount)}</span>
                        <Pill value={offer.status} />
                      </div>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                        {offer.sender_role === 'contractor'
                          ? `Contractor: ${companyById.get(offer.sender_id) ?? profileById.get(offer.sender_id) ?? emailById.get(offer.sender_id) ?? 'Contractor'}`
                          : 'Homeowner'}
                        {offer.timeline_days ? ` · ${offer.timeline_days} days` : ''}
                        {' · '}{formatWhen(offer.created_at)}
                      </p>
                      {offer.notes && <p className="mt-1 text-xs text-slate-500">{offer.notes}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* CONVERSATIONS */}
          <Panel title="Conversations" description={`${conversationRows.length} deal room(s) opened`}>
            {conversationRows.length === 0 ? (
              <EmptyRow>No conversations on this project yet.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-100">
                {conversationRows.map((conv) => {
                  const contractorName = displayName(conv.contractor_id);
                  const count = msgCount.get(conv.id) ?? 0;
                  const isWinner = conv.contractor_id === awardedContractorId;
                  return (
                    <li key={conv.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${isWinner ? 'bg-emerald-50' : ''}`}>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isWinner && (
                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">WINNER</span>
                          )}
                          <span className="text-sm font-bold text-slate-900">{contractorName}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{count} msg</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          Last activity: {conv.last_message_at ? formatWhen(conv.last_message_at) : '—'} · Started {formatWhen(conv.created_at)}
                        </p>
                      </div>
                      <Link
                        href={`/admin/conversations/${conv.id}`}
                        className="text-xs font-black text-orange-600 hover:underline"
                      >
                        Open thread →
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* PAYMENT RECORDS */}
          <Panel title="Payment records" description={`${paymentRows.length} payment record(s)`}>
            {paymentRows.length === 0 ? (
              <EmptyRow>No payment record found.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-100">
                {paymentRows.map((payment) => (
                  <li key={payment.id} className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill value={payment.status ?? 'payment'} />
                      <span className="text-sm font-black text-slate-900">{money(payment.total_amount)}</span>
                      <span className="text-xs text-slate-400">{formatWhen(payment.created_at)}</span>
                    </div>
                    <dl className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                      <SmallRow label="Homeowner (payer)" value={displayName(payment.payer_id)} />
                      <SmallRow label="Contractor (earns)" value={displayName(payment.payee_id)} />
                      <SmallRow label="Project amount" value={money(payment.project_amount)} />
                      <SmallRow label="Protection hold" value={money(payment.protection_hold_amount)} />
                      <SmallRow label="Platform fee" value={money(payment.contractor_fee_amount)} />
                      <SmallRow label="Contractor payout" value={money(payment.contractor_payout_amount)} />
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* ACTIVITY LOG */}
          <Panel title="Activity log" description={`${eventRows.length} event(s)`}>
            {eventRows.length === 0 ? (
              <EmptyRow>No marketplace events yet.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-100">
                {eventRows.map((event) => (
                  <li key={event.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill value={event.event_type ?? 'event'} />
                      <span className="text-sm font-bold text-slate-800">{event.summary}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-400">{formatWhen(event.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-5">
          <Panel title="Admin controls">
            <div className="space-y-3 px-4 py-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Moderation</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">Status: <span className="font-black">{project.moderation_status ?? 'pending'}</span></p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={approveProject}>
                    <input type="hidden" name="id" value={project.id} />
                    <AdminActionButton tone="emerald" confirm="Approve and publish this project?">Approve</AdminActionButton>
                  </form>
                  <form action={rejectProject} className="flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={project.id} />
                    <input name="note" placeholder="Rejection reason" className="h-9 w-40 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-slate-400" />
                    <AdminActionButton tone="rose" confirm="Reject this project?">Reject</AdminActionButton>
                  </form>
                </div>
              </div>

              <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-3">
                <div className="text-xs font-black uppercase tracking-wide text-orange-700">Escrow</div>
                <p className="mt-1 text-sm leading-6 text-orange-950/80">Review messages, offers and payment before acting.</p>
                <div className="mt-3 grid gap-2">
                  <form action={releaseProjectEscrow} className="flex gap-2">
                    <input type="hidden" name="projectId" value={project.id} />
                    <input name="note" placeholder="Release note" className="h-9 min-w-0 flex-1 rounded-xl border border-orange-200 bg-white px-3 text-xs font-semibold outline-none focus:border-orange-400" />
                    <AdminActionButton tone="emerald" confirm="Release held escrow to contractor?">Release</AdminActionButton>
                  </form>
                  <form action={refundProjectEscrow} className="flex gap-2">
                    <input type="hidden" name="projectId" value={project.id} />
                    <input name="note" placeholder="Refund note" className="h-9 min-w-0 flex-1 rounded-xl border border-orange-200 bg-white px-3 text-xs font-semibold outline-none focus:border-orange-400" />
                    <AdminActionButton tone="rose" confirm="Refund escrow to homeowner?">Refund</AdminActionButton>
                  </form>
                </div>
              </div>
            </div>
          </Panel>

          {/* HOMEOWNER CARD */}
          <Panel title="Homeowner">
            <div className="px-4 py-4">
              <div className="text-sm font-black text-slate-900">{homeownerName}</div>
              {homeowner?.full_name && emailById.get(project.homeowner_id) && (
                <p className="text-xs text-slate-500">{emailById.get(project.homeowner_id)}</p>
              )}
              <p className="mt-1 text-xs font-semibold text-slate-400">{homeowner?.phone ?? 'No phone'}</p>
              <Link href={`/admin/users/${project.homeowner_id}`} className="mt-3 inline-flex text-xs font-black text-orange-600 hover:underline">Open user profile</Link>
            </div>
          </Panel>

          {/* ACCEPTED CONTRACTOR CARD */}
          {awardedContractorId && (
            <Panel title="Accepted contractor">
              <div className="px-4 py-4">
                <div className="text-sm font-black text-emerald-700">{awardedContractorName}</div>
                <div className="mt-2 text-xs font-semibold text-slate-500">
                  Agreed price: <span className="font-black text-slate-900">{money(awardedOffer?.amount)}</span>
                </div>
                {awardedOffer?.timeline_days && (
                  <div className="text-xs font-semibold text-slate-500">
                    Timeline: <span className="font-black text-slate-900">{awardedOffer.timeline_days} days</span>
                  </div>
                )}
                <Link href={`/admin/contractors/${awardedContractorId}`} className="mt-3 inline-flex text-xs font-black text-orange-600 hover:underline">Open contractor profile</Link>
              </div>
            </Panel>
          )}

          {/* PROJECT METADATA */}
          <Panel title="Project metadata">
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="Project ID" value={<span className="font-mono text-[11px]">{project.id}</span>} />
              <Row label="Category" value={category?.name ?? '—'} />
              <Row label="Status" value={<Pill value={project.status ?? 'unknown'} />} />
              <Row label="Payment" value={<Pill value={project.payment_status ?? '—'} />} />
              <Row label="Moderation" value={<Pill value={project.moderation_status ?? 'pending'} />} />
              <Row label="Fee status" value={<Pill value={project.contractor_fee_status ?? 'not_due'} />} />
              <Row label="Photos" value={`${photoRows.length}`} />
              <Row label="Offers" value={`${offerRows.length}`} />
              <Row label="Conversations" value={`${conversationRows.length}`} />
              <Row label="Payments" value={`${paymentRows.length}`} />
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="shrink-0 text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function SmallRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</span>
      <span className="font-bold text-slate-800">{value}</span>
    </div>
  );
}
