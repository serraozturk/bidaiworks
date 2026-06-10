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
  recipient_id?: string | null;
  recipient_role?: 'homeowner' | 'contractor' | null;
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

type ProjectRow = {
  id: string;
  title: string;
  status: string;
  selected_offer_id: string | null;
  awarded_offer_id: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  categories: { name: string } | { name: string }[] | null;
};

type ConversationRow = {
  id: string;
  project_id: string;
  homeowner_id: string;
  contractor_id: string;
};

type ContractorInfo = {
  user_id: string;
  company_name: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  verified: boolean | null;
  years_in_business: number | null;
  bio: string | null;
};

type DisplayOffer = OfferRow & {
  contractorId: string | null;
  contractor: ContractorInfo | null;
  threadKey: string;
};

const ACTIVE_OFFER_STATUSES = [
  'pending',
  'countered',
  'payment_pending',
  'accepted',
];

const CLOSED_OFFER_STATUSES = ['rejected', 'expired', 'withdrawn'];

export default async function HomeownerOffersPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: projects, error: projectsError }, conversationCount] =
    await Promise.all([
      supabase
        .from('projects')
        .select(
          `
          id,
          title,
          status,
          selected_offer_id,
          awarded_offer_id,
          zip_code,
          city,
          state,
          created_at,
          categories(name)
        `,
        )
        .eq('homeowner_id', user.id)
        .order('created_at', { ascending: false }),

      countUnreadConversations(supabase, user.id, 'homeowner'),
    ]);

  if (projectsError) {
    console.error('Homeowner projects query error:', projectsError);
    throw new Error(projectsError.message);
  }

  const projectRows = (projects ?? []) as ProjectRow[];
  const projectIds = projectRows.map((project) => project.id);

  let allOffers: OfferRow[] = [];

  if (projectIds.length > 0) {
    const { data: offerRows, error: offersError } = await supabase
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
      .in('project_id', projectIds)
      .order('created_at', { ascending: false });

    if (offersError) {
      console.error('Homeowner offers query error:', offersError);
      throw new Error(offersError.message);
    }

    allOffers = (offerRows ?? []) as OfferRow[];
  }

  const conversationIds = Array.from(
    new Set(
      allOffers
        .map((offer) => offer.conversation_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  let conversationsById = new Map<string, ConversationRow>();

  if (conversationIds.length > 0) {
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select(
        `
        id,
        project_id,
        homeowner_id,
        contractor_id
      `,
      )
      .in('id', conversationIds);

    if (conversationsError) {
      console.error('Offer conversations query error:', conversationsError);
      throw new Error(conversationsError.message);
    }

    conversationsById = new Map(
      ((conversations ?? []) as ConversationRow[]).map((conversation) => [
        conversation.id,
        conversation,
      ]),
    );
  }

  const contractorIds = Array.from(
    new Set(
      allOffers
        .map((offer) => getContractorIdFromOffer(offer, conversationsById))
        .filter((id): id is string => Boolean(id)),
    ),
  );

  let contractorsById = new Map<string, ContractorInfo>();

  if (contractorIds.length > 0) {
    const { data: contractors, error: contractorsError } = await supabase
      .from('contractor_profiles')
      .select(
        `
        user_id,
        company_name,
        rating_avg,
        rating_count,
        verified,
        years_in_business,
        bio
      `,
      )
      .in('user_id', contractorIds);

    if (contractorsError) {
      console.error('Contractor profiles query error:', contractorsError);
      throw new Error(contractorsError.message);
    }

    contractorsById = new Map(
      ((contractors ?? []) as ContractorInfo[]).map((contractor) => [
        contractor.user_id,
        contractor,
      ]),
    );
  }

  const displayOffers = buildLatestDisplayOffers(
    allOffers,
    conversationsById,
    contractorsById,
  );

  const totalOffers = displayOffers.length;

  const needsReviewCount = displayOffers.filter((offer) =>
    isHomeownerTurn(offer),
  ).length;

  const paymentPendingOffers = displayOffers.filter(
    (offer) => offer.status === 'payment_pending',
  ).length;

  const acceptedOffers = displayOffers.filter(
    (offer) => offer.status === 'accepted',
  ).length;

  const openOfferCount = displayOffers.filter((offer) =>
    ['pending', 'countered', 'payment_pending'].includes(offer.status),
  ).length;

  const projectsWithOffers = projectRows.filter((project) =>
    displayOffers.some((offer) => offer.project_id === project.id),
  ).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role="homeowner"
          active="compare"
          messageCount={conversationCount ?? 0}
          quoteCount={openOfferCount}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1480px] px-5 py-5">
            <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#f4510b]">
                  Offer center
                </p>

                <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                  Offers across your projects
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Review the latest contractor offers, counter offers, payment
                  status and scope details without seeing every old negotiation
                  step as a separate card.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/homeowner/compare"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-[#0f172a] shadow-sm transition hover:bg-slate-50"
                >
                  Compare offers
                </Link>

                <Link
                  href="/dashboard/homeowner/new"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[#f4510b] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#d94406]"
                >
                  New project
                </Link>
              </div>
            </header>

            <section className="mb-5 grid gap-3 md:grid-cols-5">
              <Metric label="Projects with offers" value={String(projectsWithOffers)} />
              <Metric label="Latest offers" value={String(totalOffers)} />
              <Metric label="Needs review" value={String(needsReviewCount)} accent />
              <Metric label="Payment pending" value={String(paymentPendingOffers)} />
              <Metric label="Accepted" value={String(acceptedOffers)} />
            </section>

            <section className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-amber-800">
                    Marketplace safety rule
                  </div>

                  <p className="mt-1 max-w-4xl text-sm leading-6 text-amber-950/80">
                    Keep negotiation, scope changes and payments inside bidAI.
                    External phone numbers, emails, social media accounts,
                    payment links or direct payment instructions should not be
                    shared before checkout.
                  </p>
                </div>

                <Badge tone="warning">Protected checkout</Badge>
              </div>
            </section>

            {projectRows.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-4">
                {projectRows.map((project) => {
                  const projectOffers = displayOffers.filter(
                    (offer) => offer.project_id === project.id,
                  );

                  const activeOffers = projectOffers.filter((offer) =>
                    ACTIVE_OFFER_STATUSES.includes(offer.status),
                  );

                  const hasPaymentPending = projectOffers.some(
                    (offer) => offer.status === 'payment_pending',
                  );

                  const canCompare = projectOffers.length > 0;

                  return (
                    <section
                      key={project.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                      <ProjectHeader
                        project={project}
                        offerCount={projectOffers.length}
                        activeCount={activeOffers.length}
                        hasPaymentPending={hasPaymentPending}
                        canCompare={canCompare}
                      />

                      {projectOffers.length === 0 ? (
                        <div className="px-5 py-8 text-sm text-slate-500">
                          No contractor offers yet for this project.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {projectOffers.map((offer) => (
                            <OfferLine
                              key={offer.id}
                              offer={offer}
                              project={project}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function ProjectHeader({
  project,
  offerCount,
  activeCount,
  hasPaymentPending,
  canCompare,
}: {
  project: ProjectRow;
  offerCount: number;
  activeCount: number;
  hasPaymentPending: boolean;
  canCompare: boolean;
}) {
  return (
    <div className="border-b border-slate-100 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-black text-[#0f172a]">
              {project.title}
            </h2>

            <ProjectStatusBadge status={project.status} />

            {hasPaymentPending && <Badge tone="warning">Checkout waiting</Badge>}
          </div>

          <p className="mt-1 text-xs font-semibold text-slate-500">
            {firstRow(project.categories)?.name ?? 'Renovation'}
            {project.zip_code ? ` · ZIP ${project.zip_code}` : ''}
            {project.city ? ` · ${project.city}` : ''}
            {project.state ? `, ${project.state}` : ''}
            {project.created_at ? ` · posted ${relativeTime(project.created_at)}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
            {offerCount} latest offer{offerCount === 1 ? '' : 's'}
          </span>

          <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-700">
            {activeCount} active
          </span>

          {canCompare && (
            <Link
              href={`/dashboard/homeowner/compare?project=${project.id}`}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f45112] px-3 text-xs font-black text-white transition hover:bg-[#d94406]"
            >
              Compare
            </Link>
          )}

          <Link
            href={`/dashboard/homeowner/projects/${project.id}`}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
          >
            View project
          </Link>
        </div>
      </div>
    </div>
  );
}

function OfferLine({
  offer,
  project,
}: {
  offer: DisplayOffer;
  project: ProjectRow;
}) {
  const company = offer.contractor?.company_name ?? 'Contractor';
  const selectedOfferId = project.selected_offer_id ?? project.awarded_offer_id;
  const isSelected = selectedOfferId === offer.id;
  const isClosed = CLOSED_OFFER_STATUSES.includes(offer.status);
  const homeownerTurn = isHomeownerTurn(offer);
  const scope = normalizeOfferScope(offer);

  const messageHref = offer.contractorId
    ? `/dashboard/messages/${offer.project_id}/${offer.contractorId}`
    : `/dashboard/homeowner/projects/${offer.project_id}`;

  const checkoutHref = `/dashboard/checkout/project/${offer.project_id}`;
  const compareHref = `/dashboard/homeowner/compare?project=${offer.project_id}`;

  return (
    <article
      className={[
        'grid grid-cols-[minmax(230px,1.5fr)_130px_130px_160px_220px] items-center gap-4 px-5 py-4 transition',
        homeownerTurn ? 'bg-orange-50/50' : 'bg-white hover:bg-slate-50',
        isClosed ? 'opacity-70' : '',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-black text-[#0f172a]">
            {offer.sender_role === 'homeowner' ? 'Your counter offer' : company}
          </h3>

          {offer.contractor?.verified && <Badge tone="success">Verified</Badge>}
          {isSelected && <Badge tone="success">Selected</Badge>}
          {homeownerTurn && <Badge tone="warning">Your turn</Badge>}
          <OfferStatusBadge status={offer.status} />
        </div>

        <p className="mt-1 truncate text-xs font-semibold text-slate-500">
          {offer.sender_role === 'homeowner'
            ? `Sent by you${company ? ` · to ${company}` : ''}`
            : `★ ${
                offer.contractor?.rating_count
                  ? Number(offer.contractor.rating_avg).toFixed(1)
                  : 'New'
              } · ${offer.contractor?.rating_count ?? 0} reviews${
                offer.contractor?.years_in_business
                  ? ` · ${offer.contractor.years_in_business} yrs`
                  : ''
              }`}
        </p>

        <p className="mt-1 truncate text-[11px] font-medium text-slate-400">
          {offer.kind ? readableStatus(offer.kind) : 'Offer'}
          {offer.created_at ? ` · ${relativeTime(offer.created_at)}` : ''}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          Amount
        </p>

        <p className="mt-1 text-sm font-black text-[#0f172a]">
          {formatCurrency(Number(offer.amount))}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          Timeline
        </p>

        <p className="mt-1 text-sm font-black text-[#0f172a]">
          {offer.timeline_days ? `${offer.timeline_days} days` : 'TBD'}
        </p>
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          Scope
        </p>

        <p className="mt-1 truncate text-xs font-semibold text-slate-600">
          {scope.included[0] ?? scope.notes[0] ?? 'Scope not specified'}
        </p>

        {scope.excluded.length > 0 && (
          <p className="mt-0.5 truncate text-[11px] font-medium text-rose-500">
            Excludes: {scope.excluded[0]}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Link
          href={compareHref}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
        >
          Compare
        </Link>

        {offer.status === 'payment_pending' ? (
          <Link
            href={checkoutHref}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f4510b] px-3 text-xs font-black text-white transition hover:bg-[#d94406]"
          >
            Checkout
          </Link>
        ) : (
          <Link
            href={messageHref}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#f45112] px-3 text-xs font-black text-white transition hover:bg-[#d94406]"
          >
            Deal room
          </Link>
        )}
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-lg border px-4 py-3 shadow-sm',
        accent
          ? 'border-orange-200 bg-orange-50'
          : 'border-slate-200 bg-white',
      ].join(' ')}
    >
      <div
        className={[
          'text-[10px] font-black uppercase tracking-wide',
          accent ? 'text-orange-700' : 'text-slate-500',
        ].join(' ')}
      >
        {label}
      </div>

      <div className="mt-1 text-2xl font-black tracking-tight text-[#0f172a]">
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-orange-50 text-xl font-black text-[#f4510b]">
        $
      </div>

      <h2 className="mt-4 text-lg font-black text-[#0f172a]">
        No offers yet
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Post a project first. Contractor offers and counter offers will appear
        here once negotiation starts.
      </p>

      <Link
        href="/dashboard/homeowner/new"
        className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-[#f4510b] px-4 text-sm font-black text-white transition hover:bg-[#d94406]"
      >
        Start a project
      </Link>
    </div>
  );
}

function buildLatestDisplayOffers(
  offers: OfferRow[],
  conversationsById: Map<string, ConversationRow>,
  contractorsById: Map<string, ContractorInfo>,
): DisplayOffer[] {
  const latestByThread = new Map<string, DisplayOffer>();

  for (const offer of offers) {
    const contractorId = getContractorIdFromOffer(offer, conversationsById);
    const threadKey = getOfferThreadKey(offer, contractorId);
    const contractor = contractorId ? contractorsById.get(contractorId) ?? null : null;

    const current = latestByThread.get(threadKey);

    const displayOffer: DisplayOffer = {
      ...offer,
      contractorId,
      contractor,
      threadKey,
    };

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
    const aPriority = isHomeownerTurn(a) ? 1 : 0;
    const bPriority = isHomeownerTurn(b) ? 1 : 0;

    if (aPriority !== bPriority) return bPriority - aPriority;

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

function getContractorIdFromOffer(
  offer: OfferRow,
  conversationsById: Map<string, ConversationRow>,
): string | null {
  if (offer.sender_role === 'contractor') return offer.sender_id;

  if (offer.recipient_role === 'contractor' && offer.recipient_id) {
    return offer.recipient_id;
  }

  if (offer.conversation_id) {
    return conversationsById.get(offer.conversation_id)?.contractor_id ?? null;
  }

  return null;
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

  if (status === 'paid' || status === 'in_progress') {
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
  if (status === 'pending') return <Badge tone="warning">Pending</Badge>;
  if (status === 'countered') return <Badge tone="brand">Countered</Badge>;
  if (status === 'payment_pending') return <Badge tone="warning">Payment</Badge>;
  if (status === 'accepted') return <Badge tone="success">Accepted</Badge>;
  if (status === 'rejected') return <Badge tone="default">Rejected</Badge>;
  if (status === 'expired') return <Badge tone="default">Expired</Badge>;
  if (status === 'withdrawn') return <Badge tone="default">Withdrawn</Badge>;

  return <Badge tone="default">{readableStatus(status)}</Badge>;
}

function readableStatus(status: string): string {
  if (!status) return 'Unknown';

  return status.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase());
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}