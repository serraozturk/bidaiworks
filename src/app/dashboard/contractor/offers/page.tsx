export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, relativeTime } from '@/lib/utils';
import { countUnreadConversations } from '@/lib/unread';

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
  created_at: string;
  included_items: string[] | string | null;
  excluded_items: string[] | string | null;
  notes: string[] | string | null;
  scope_summary: string | null;
  message: string | null;
  projects: any;
};

export default async function ContractorOffersPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'contractor') redirect('/dashboard');

  const [{ data: offers, error: offersError }, conversationCount] =
    await Promise.all([
      supabase
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
    created_at,
    included_items,
    excluded_items,
    notes,
    scope_summary,
    message,
    projects!offers_project_id_fkey(
      id,
      title,
      zip_code,
      city,
      state,
      status,
      payment_status,
      homeowner_id,
      categories(name)
    )
  `)
        .or(
          `sender_id.eq.${user.id},and(recipient_id.eq.${user.id},recipient_role.eq.contractor)`,
        )
        .order('created_at', { ascending: false }),

      countUnreadConversations(supabase, user.id, 'contractor'),
    ]);

  if (offersError) {
    console.error('Contractor offers query error:', offersError);
    throw new Error(offersError.message);
  }

  const rows = (offers ?? []) as OfferRow[];

  const activePipeline = rows.filter((offer) =>
    ['pending', 'payment_pending', 'countered'].includes(offer.status),
  );

  const needsResponse = rows.filter(
    (offer) =>
      ['pending', 'countered'].includes(offer.status) &&
      offer.sender_role === 'homeowner',
  );

  const accepted = rows.filter((offer) => offer.status === 'accepted');

  const closed = rows.filter((offer) =>
    ['rejected', 'expired', 'withdrawn'].includes(offer.status),
  );

  const pendingValue = activePipeline.reduce(
    (sum, offer) => sum + Number(offer.amount ?? 0),
    0,
  );

  const acceptedValue = accepted.reduce(
    (sum, offer) => sum + Number(offer.amount ?? 0),
    0,
  );

  const winBase = accepted.length + closed.length;
  const winRate = winBase ? Math.round((accepted.length / winBase) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role="contractor"
          active="offers"
          messageCount={conversationCount ?? 0}
          offerCount={activePipeline.length}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1480px] px-5 py-5">
            <header className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-white px-6 py-7 text-slate-900">
                <div className="flex flex-wrap items-end justify-between gap-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f45112]">
                      Offer pipeline
                    </p>

                    <h1 className="mt-2 text-3xl font-black tracking-tight">
                      Track your active offers
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      See sent offers, homeowner counter offers, checkout
                      waiting items and accepted results from one place.
                    </p>
                  </div>

                  <Link
                    href="/dashboard/contractor"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-slate-900 transition hover:bg-orange-50"
                  >
                    Browse leads
                  </Link>
                </div>
              </div>

              <div className="grid bg-white md:grid-cols-4">
                <Metric
                  label="Active pipeline"
                  value={String(activePipeline.length)}
                  detail="Pending or checkout"
                  accent
                />

                <Metric
                  label="Needs response"
                  value={String(needsResponse.length)}
                  detail="Homeowner waiting"
                />

                <Metric
                  label="Pipeline value"
                  value={formatCurrency(pendingValue)}
                  detail="Open offer amount"
                />

                <Metric
                  label="Win rate"
                  value={`${winRate}%`}
                  detail={`${accepted.length} accepted`}
                />
              </div>
            </header>

            {needsResponse.length > 0 && (
              <section className="mb-5 rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-orange-700">
                      Action needed
                    </div>

                    <h2 className="mt-1 text-lg font-black text-orange-950">
                      {needsResponse.length} homeowner counter offer
                      {needsResponse.length === 1 ? '' : 's'} need your response
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-orange-900/80">
                      Open the deal room to accept, decline or send a new counter
                      offer.
                    </p>
                  </div>

                  <Link
                    href={`/dashboard/messages/${needsResponse[0].project_id}/${getHomeownerId(
                      needsResponse[0],
                    )}`}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-[#f4510b] px-4 text-sm font-black text-white transition hover:bg-[#d94406]"
                  >
                    Open first deal
                  </Link>
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-sm font-black text-[#0f172a]">
                    Offer list
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500">
                    One row per offer or counter offer.
                  </p>
                </div>

                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                  {rows.length} total
                </div>
              </div>

              {rows.length === 0 ? (
                <EmptyOffers />
              ) : (
                <div className="divide-y divide-slate-100">
                  {rows.map((offer) => {
                    const project = firstRow<any>(offer.projects);
                    const scope = normalizeOfferScope(offer);
                    const homeownerId = getHomeownerId(offer);
                    const projectId = project?.id ?? offer.project_id;
                    const isHomeownerOffer = offer.sender_role === 'homeowner';
                    const needsReply =
                      ['pending', 'countered'].includes(offer.status) &&
                      isHomeownerOffer;

                    return (
                      <article
                        key={offer.id}
                        className={[
                          'px-5 py-5 transition',
                          needsReply ? 'bg-orange-50/50' : 'bg-white hover:bg-slate-50',
                        ].join(' ')}
                      >
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_230px]">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-black text-[#0f172a]">
                                {project?.title ?? 'Project'}
                              </h3>

                              <Badge tone={offerTone(offer.status)}>
                                {readableStatus(offer.status)}
                              </Badge>

                              {needsReply && <Badge tone="warning">Your turn</Badge>}

                              {project?.status && (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black capitalize text-slate-600">
                                  {String(project.status).replaceAll('_', ' ')}
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {categoryName(project?.categories) ?? 'Renovation'}
                              {project?.zip_code ? ` · ZIP ${project.zip_code}` : ''}
                              {project?.city ? ` · ${project.city}` : ''}
                              {' · '}
                              {isHomeownerOffer ? 'received ' : 'sent '}
                              {relativeTime(offer.created_at)}
                            </p>

                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                              <InfoBlock
                                label="Amount"
                                value={formatCurrency(Number(offer.amount))}
                                strong
                              />

                              <InfoBlock
                                label="Timeline"
                                value={
                                  offer.timeline_days
                                    ? `${offer.timeline_days} days`
                                    : 'TBD'
                                }
                              />

                              <InfoBlock
                                label="Direction"
                                value={
                                  isHomeownerOffer
                                    ? 'Homeowner counter'
                                    : 'Your offer'
                                }
                              />
                            </div>

                            <div className="mt-4 grid gap-3 lg:grid-cols-3">
                              <CompactScope title="Included" items={scope.included} />
                              <CompactScope title="Excluded" items={scope.excluded} />
                              <CompactScope title="Notes" items={scope.notes} />
                            </div>
                          </div>

                          <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                              Actions
                            </div>

                            <div className="mt-3 grid gap-2">
                              {projectId && (
                                <Link
                                  href={`/dashboard/contractor/projects/${projectId}`}
                                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                                >
                                  View project
                                </Link>
                              )}

                              {projectId && homeownerId && (
                                <Link
                                  href={`/dashboard/messages/${projectId}/${homeownerId}`}
                                  className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f45112] px-3 text-xs font-black text-white transition hover:bg-[#d94406]"
                                >
                                  Deal room
                                </Link>
                              )}
                            </div>
                          </aside>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className="border-b border-slate-100 px-5 py-4 md:border-b-0 md:border-r md:last:border-r-0">
      <div
        className={[
          'text-[10px] font-black uppercase tracking-wide',
          accent ? 'text-[#f4510b]' : 'text-slate-500',
        ].join(' ')}
      >
        {label}
      </div>

      <div className="mt-1 text-2xl font-black tracking-tight text-[#0f172a]">
        {value}
      </div>

      <div className="mt-0.5 text-xs font-semibold text-slate-500">
        {detail}
      </div>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div
        className={[
          'mt-1 text-sm',
          strong ? 'font-black text-[#0f172a]' : 'font-bold text-slate-700',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  );
}

function CompactScope({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
        {title}
      </div>

      {items.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">Not specified</p>
      ) : (
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600">
          {items.slice(0, 4).join(' · ')}
          {items.length > 4 ? ` · +${items.length - 4} more` : ''}
        </p>
      )}
    </div>
  );
}

function EmptyOffers() {
  return (
    <div className="px-5 py-14 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-orange-50 text-xl font-black text-[#f4510b]">
        $
      </div>

      <h3 className="mt-4 text-base font-black text-[#0f172a]">
        No offers yet
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Offers and homeowner counter offers will appear here once you start
        negotiating.
      </p>

      <Link
        href="/dashboard/contractor"
        className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-[#f45112] px-4 text-sm font-black text-white transition hover:bg-[#d94406]"
      >
        Browse leads
      </Link>
    </div>
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

function offerTone(status: string): 'success' | 'warning' | 'default' | 'brand' {
  if (status === 'accepted') return 'success';
  if (status === 'rejected' || status === 'expired' || status === 'withdrawn') {
    return 'default';
  }
  if (status === 'countered') return 'brand';
  return 'warning';
}

function readableStatus(status: string): string {
  if (status === 'payment_pending') return 'Payment pending';

  return status.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase());
}

function getHomeownerId(offer: OfferRow): string | null {
  const project = firstRow<any>(offer.projects);

  if (offer.sender_role === 'homeowner') return offer.sender_id;
  if (offer.recipient_role === 'homeowner') return offer.recipient_id;
  return project?.homeowner_id ?? null;
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function categoryName(value: any): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value.name ?? null;
}
