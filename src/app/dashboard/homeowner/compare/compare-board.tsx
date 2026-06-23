'use client';

import {
  type ReactNode,
  Children,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatRange } from '@/lib/utils';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useNotice } from '@/components/ui/Notice';

type CompareProject = {
  id: string;
  title: string;
  status: string;
  zipCode: string | null;
  category: string;
  createdAt: string;
  aiEstimateMin: number | null;
  aiEstimateMax: number | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  offerCount: number;
  selectedOfferId: string | null;
  awardedOfferId: string | null;
};

type CompareOffer = {
  id: string;
  projectId: string;
  contractorId: string;
  conversationId?: string | null;

  senderId: string;
  senderRole: 'homeowner' | 'contractor';
  recipientId: string | null;
  recipientRole: 'homeowner' | 'contractor' | null;

  kind: string;
  company: string;
  amount: number;
  timelineDays: number | null;
  status: string;

  rating: string;
  reviewCount: number;
  verified: boolean;
  bio: string | null;
  yearsInBusiness?: number | null;
  completedJobsCount?: number | null;
  responseTimeHours?: number | null;
  licenseStatus?: string | null;
  insuranceStatus?: string | null;

  createdAt: string;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  expiredAt?: string | null;
  respondedAt?: string | null;

  included: string[];
  excluded: string[];
  notes: string[];

  materialAllowance?: string | null;
  assumptions?: string | null;
  riskNotes?: string | null;
  warranty?: string | null;
  offerType?: string | null;
  earliestStartDate?: string | null;

  materialsIncluded?: boolean;
  laborIncluded?: boolean;
  cleanupIncluded?: boolean;
  permitsIncluded?: boolean;
  siteVisitRequired?: boolean;

  contractorFeeAmount?: number | null;
  contractorFeeStatus?: string | null;
};

type FilterValue =
  | 'all'
  | 'pending'
  | 'verified'
  | 'payment_pending'
  | 'accepted';

type SortValue =
  | 'price_asc'
  | 'price_desc'
  | 'timeline_asc'
  | 'rating_desc'
  | 'newest';

interface Props {
  projects: CompareProject[];
  offers: CompareOffer[];
}

const MAX_COMPARE_OFFERS = 3;
const DEFAULT_COMPARE_OFFERS = 2;
const PAYMENT_WINDOW_MINUTES = 60;

export default function CompareBoard({ projects, offers }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const projectFromUrl = searchParams.get('project');

  const initialProjectId =
    projectFromUrl && projects.some((project) => project.id === projectFromUrl)
      ? projectFromUrl
      : projects[0]?.id ?? null;

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialProjectId,
  );

  const { confirm, ConfirmDialogNode } = useConfirm();
  const { notice, NoticeNode } = useNotice();

  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [sort, setSort] = useState<SortValue>('price_asc');
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectFromUrl) return;
    if (!projects.some((project) => project.id === projectFromUrl)) return;

    setSelectedProjectId(projectFromUrl);
    setSelectedOfferIds([]);
    setFilter('all');
    setSort('price_asc');
  }, [projectFromUrl, projects]);

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;

  const projectOffers = useMemo(() => {
    let rows = offers.filter((offer) => offer.projectId === selectedProjectId);

    if (filter === 'pending') {
      rows = rows.filter((offer) =>
        ['pending', 'countered'].includes(offer.status),
      );
    }

    if (filter === 'verified') {
      rows = rows.filter((offer) => offer.verified);
    }

    if (filter === 'payment_pending') {
      rows = rows.filter((offer) => offer.status === 'payment_pending');
    }

    if (filter === 'accepted') {
      rows = rows.filter((offer) => offer.status === 'accepted');
    }

    return [...rows].sort((a, b) => {
      if (sort === 'price_asc') return a.amount - b.amount;
      if (sort === 'price_desc') return b.amount - a.amount;

      if (sort === 'timeline_asc') {
        return (a.timelineDays ?? 999999) - (b.timelineDays ?? 999999);
      }

      if (sort === 'rating_desc') {
        return ratingNumber(b.rating) - ratingNumber(a.rating);
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [offers, selectedProjectId, filter, sort]);

  useEffect(() => {
    if (projectOffers.length === 0) {
      setSelectedOfferIds([]);
      return;
    }

    setSelectedOfferIds((current) => {
      const visibleIds = new Set(projectOffers.map((offer) => offer.id));
      const stillVisible = current.filter((id) => visibleIds.has(id));

      if (stillVisible.length > 0) {
        return stillVisible.slice(0, MAX_COMPARE_OFFERS);
      }

      return projectOffers
        .slice(0, Math.min(DEFAULT_COMPARE_OFFERS, projectOffers.length))
        .map((offer) => offer.id);
    });
  }, [projectOffers]);

  const selectedOffers = useMemo(() => {
    return projectOffers.filter((offer) => selectedOfferIds.includes(offer.id));
  }, [projectOffers, selectedOfferIds]);

  const bestPrice = projectOffers.length
    ? Math.min(...projectOffers.map((offer) => offer.amount))
    : null;

  const fastestTimeline =
    projectOffers
      .map((offer) => offer.timelineDays)
      .filter((value): value is number => typeof value === 'number')
      .sort((a, b) => a - b)[0] ?? null;

  const verifiedCount = projectOffers.filter((offer) => offer.verified).length;

  function selectProject(projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedOfferIds([]);
    setFilter('all');
    setSort('price_asc');

    router.replace(`/dashboard/homeowner/compare?project=${projectId}`, {
      scroll: false,
    });
  }

  function toggleOffer(id: string) {
    setSelectedOfferIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      if (current.length >= MAX_COMPARE_OFFERS) {
        notice(`You can compare up to ${MAX_COMPARE_OFFERS} offers at the same time.`);
        return current;
      }

      return [...current, id];
    });
  }

  async function acceptOffer(offer: CompareOffer) {
    const confirmed = await confirm({
      title: `Accept ${offer.company}'s offer for ${formatCurrency(offer.amount)}?`,
      message: 'You will continue to checkout before the contractor is booked.',
      confirmLabel: 'Accept & checkout',
    });

    if (!confirmed) return;

    setBusyOfferId(offer.id);

    const { error } = await supabase.rpc('reserve_offer_for_payment', {
      p_offer_id: offer.id,
      p_payment_window_minutes: PAYMENT_WINDOW_MINUTES,
    });

    if (error) {
      setBusyOfferId(null);
      notice(error.message);
      return;
    }

    await notifyMarketplace('offer_accepted', { offerId: offer.id });

    router.push(`/dashboard/checkout/project/${offer.projectId}`);
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
        <h2 className="text-lg font-black text-[#0f172a]">
          No projects yet
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Create a project first. Contractor offers will appear here.
        </p>

        <Link
          href="/dashboard/homeowner/new"
          className="mt-5 inline-flex rounded-xl bg-[#f4510b] px-4 py-2 text-sm font-black text-white transition hover:bg-[#d94406]"
        >
          New project
        </Link>
      </div>
    );
  }

  return (
    <>
    {ConfirmDialogNode}
    {NoticeNode}
    <div className="grid gap-4">
      <div className="grid min-h-[610px] grid-cols-[300px_minmax(0,1fr)] gap-4">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <PanelHeader
            title="Projects"
            subtitle={`${projects.length} projects`}
            right={
              <Link
                href="/dashboard/homeowner/new"
                className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-[#f4510b] transition hover:bg-orange-100"
              >
                New
              </Link>
            }
          />

          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            <div className="space-y-2">
              {projects.map((project) => {
                const active = project.id === selectedProjectId;

                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => selectProject(project.id)}
                    className={[
                      'w-full rounded-lg border p-3 text-left transition',
                      active
                        ? 'border-orange-300 bg-orange-50 shadow-sm ring-2 ring-orange-100'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3
                          className={[
                            'truncate text-sm font-black',
                            active ? 'text-orange-950' : 'text-[#0f172a]',
                          ].join(' ')}
                        >
                          {project.title}
                        </h3>

                        <p className="mt-1 truncate text-xs font-bold text-slate-500">
                          {project.category}
                        </p>

                        <p className="mt-1 truncate text-[11px] text-slate-400">
                          {project.zipCode ? `ZIP ${project.zipCode}` : 'No ZIP'}
                        </p>
                      </div>

                      <span
                        className={[
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black',
                          active
                            ? 'bg-white text-orange-700'
                            : 'bg-slate-100 text-slate-600',
                        ].join(' ')}
                      >
                        {project.offerCount}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-bold text-slate-500">
                        {formatRange(project.aiEstimateMin, project.aiEstimateMax)}
                      </span>

                      <StatusBadge status={project.status} compact />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <PanelHeader
            title="Offer decision board"
            subtitle={selectedProject ? selectedProject.title : 'Select project'}
            right={
              <div className="flex items-center gap-2">
                <MetricPill label="Offers" value={projectOffers.length} />
                <MetricPill label="Selected" value={`${selectedOffers.length}/${MAX_COMPARE_OFFERS}`} accent />
              </div>
            }
          />

          <div className="border-b border-slate-100 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <FilterPill current={filter} value="all" onClick={setFilter}>
                All
              </FilterPill>

              <FilterPill current={filter} value="pending" onClick={setFilter}>
                Negotiating
              </FilterPill>

              <FilterPill current={filter} value="verified" onClick={setFilter}>
                Verified
              </FilterPill>

              <FilterPill
                current={filter}
                value="payment_pending"
                onClick={setFilter}
              >
                Checkout
              </FilterPill>

              <FilterPill current={filter} value="accepted" onClick={setFilter}>
                Accepted
              </FilterPill>

              <div className="ml-auto min-w-[190px]">
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortValue)}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-[#0f172a] outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                >
                  <option value="price_asc">Lowest price</option>
                  <option value="price_desc">Highest price</option>
                  <option value="timeline_asc">Fastest timeline</option>
                  <option value="rating_desc">Highest rating</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              <MiniStat
                label="Best price"
                value={bestPrice ? formatCurrency(bestPrice) : '—'}
              />

              <MiniStat
                label="Fastest"
                value={fastestTimeline ? `${fastestTimeline} days` : '—'}
              />

              <MiniStat
                label="Verified"
                value={`${verifiedCount}`}
              />

              <MiniStat
                label="AI estimate"
                value={
                  selectedProject
                    ? formatRange(
                        selectedProject.aiEstimateMin,
                        selectedProject.aiEstimateMax,
                      )
                    : '—'
                }
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {projectOffers.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  title="No offers"
                  text="Try another filter or wait for contractor offers."
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {projectOffers.map((offer) => {
                  const checked = selectedOfferIds.includes(offer.id);
                  const disabled =
                    !checked && selectedOfferIds.length >= MAX_COMPARE_OFFERS;

                  return (
                    <OfferRow
                      key={offer.id}
                      offer={offer}
                      checked={checked}
                      disabled={disabled}
                      busy={busyOfferId === offer.id}
                      bestPrice={bestPrice === offer.amount}
                      fastestTimeline={
                        fastestTimeline !== null &&
                        offer.timelineDays === fastestTimeline
                      }
                      onToggle={() => toggleOffer(offer.id)}
                      onAccept={() => acceptOffer(offer)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <PanelHeader
          title="Side-by-side comparison"
          subtitle="Compare selected offers by price, scope, material assumptions and risk."
          right={
            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-black text-orange-700">
              {selectedOffers.length}/{MAX_COMPARE_OFFERS}
            </span>
          }
        />

        <div className="p-3">
          <CompareDetails offers={selectedOffers} />
        </div>
      </section>
    </div>
    </>
  );
}

function OfferRow({
  offer,
  checked,
  disabled,
  busy,
  bestPrice,
  fastestTimeline,
  onToggle,
  onAccept,
}: {
  offer: CompareOffer;
  checked: boolean;
  disabled: boolean;
  busy: boolean;
  bestPrice: boolean;
  fastestTimeline: boolean;
  onToggle: () => void;
  onAccept: () => void;
}) {
  return (
    <article
      className={[
        'grid grid-cols-[32px_minmax(220px,1.35fr)_120px_115px_150px_160px_190px] items-center gap-3 px-4 py-3 transition',
        checked ? 'bg-orange-50/70' : 'bg-white hover:bg-slate-50',
        disabled ? 'opacity-60' : '',
      ].join(' ')}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="h-4 w-4 accent-orange-600"
      />

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <h3 className="truncate text-sm font-black text-[#0f172a]">
            {offer.company}
          </h3>

          {offer.verified && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">
              Verified
            </span>
          )}

          {bestPrice && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black text-blue-700">
              Best price
            </span>
          )}

          {fastestTimeline && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-black text-purple-700">
              Fastest
            </span>
          )}
        </div>

        <p className="mt-1 truncate text-xs font-bold text-slate-500">
          ★ {offer.rating} · {offer.reviewCount} reviews
        </p>

        <div className="mt-1 flex flex-wrap gap-1">
          <TinyFlag label="License" value={offer.licenseStatus} />
          <TinyFlag label="Insurance" value={offer.insuranceStatus} />
        </div>
      </div>

      <MiniColumn label="Price" value={formatCurrency(offer.amount)} />

      <MiniColumn
        label="Timeline"
        value={offer.timelineDays ? `${offer.timelineDays}d` : 'TBD'}
      />

      <MiniColumn
        label="Start"
        value={offer.earliestStartDate || 'Not set'}
      />

      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          Type
        </p>

        <p className="text-xs font-black leading-4 text-[#0f172a]">
          {readableOfferType(offer.offerType)}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Link
          href={`/dashboard/messages/${offer.projectId}/${offer.contractorId}`}
          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-200"
        >
          Deal room
        </Link>

        {offer.status === 'pending' ? (
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="rounded-full bg-[#f45112] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[#d94406] disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Accept'}
          </button>
        ) : offer.status === 'payment_pending' ? (
          <Link
            href={`/dashboard/checkout/project/${offer.projectId}`}
            className="rounded-full bg-[#f4510b] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[#d94406]"
          >
            Checkout
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function CompareDetails({ offers }: { offers: CompareOffer[] }) {
  if (offers.length === 0) {
    return (
      <EmptyState
        title="No offer selected"
        text="Select offers from the offer board to compare price, timeline, included work, exclusions, material allowance and risk notes."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px] overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div
          className="grid border-b border-slate-200 bg-slate-50"
          style={{
            gridTemplateColumns: `180px repeat(${offers.length}, minmax(260px, 1fr))`,
          }}
        >
          <div className="border-r border-slate-200 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">
              Compare
            </p>
          </div>

          {offers.map((offer) => (
            <div
              key={offer.id}
              className="border-r border-slate-200 px-4 py-3 last:border-r-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black text-[#0f172a]">
                    {offer.company}
                  </h3>

                  <p className="mt-1 text-xs font-bold text-slate-500">
                    ★ {offer.rating} · {offer.reviewCount} reviews
                  </p>
                </div>

                <StatusBadge status={offer.status} compact />
              </div>
            </div>
          ))}
        </div>

        <CompareRow label="Price">
          {offers.map((offer) => (
            <CompareCell key={offer.id}>
              <p className="text-lg font-black text-[#0f172a]">
                {formatCurrency(offer.amount)}
              </p>
            </CompareCell>
          ))}
        </CompareRow>

        <CompareRow label="Timeline">
          {offers.map((offer) => (
            <CompareCell key={offer.id}>
              <p className="text-sm font-black text-[#0f172a]">
                {offer.timelineDays ? `${offer.timelineDays} days` : 'TBD'}
              </p>
            </CompareCell>
          ))}
        </CompareRow>

        <CompareRow label="Earliest start">
          {offers.map((offer) => (
            <CompareCell key={offer.id}>
              <TextValue value={offer.earliestStartDate} empty="Not specified" />
            </CompareCell>
          ))}
        </CompareRow>

        <CompareRow label="Offer type">
          {offers.map((offer) => (
            <CompareCell key={offer.id}>
              <TextValue value={readableOfferType(offer.offerType)} />
            </CompareCell>
          ))}
        </CompareRow>

        <CompareRow label="Contractor trust">
          {offers.map((offer) => (
            <CompareCell key={offer.id}>
              <div className="space-y-2">
                <TrustLine label="Verified" value={offer.verified ? 'Yes' : 'No'} />
                <TrustLine label="License" value={offer.licenseStatus || 'Not listed'} />
                <TrustLine label="Insurance" value={offer.insuranceStatus || 'Not listed'} />
                <TrustLine
                  label="Completed jobs"
                  value={
                    offer.completedJobsCount !== null &&
                    offer.completedJobsCount !== undefined
                      ? String(offer.completedJobsCount)
                      : 'Not listed'
                  }
                />
                <TrustLine
                  label="Response time"
                  value={
                    offer.responseTimeHours
                      ? `${offer.responseTimeHours}h`
                      : 'Not listed'
                  }
                />
              </div>
            </CompareCell>
          ))}
        </CompareRow>

        <CompareRow label="Offer conditions">
          {offers.map((offer) => (
            <CompareCell key={offer.id}>
              <ConditionGrid offer={offer} />
            </CompareCell>
          ))}
        </CompareRow>

        <CompareRow label="Included">
          {offers.map((offer) => (
            <CompareCell key={offer.id}>
              <ScopeItems
                items={offer.included}
                emptyText="Not specified"
                tone="included"
              />
            </CompareCell>
          ))}
        </CompareRow>

        <CompareRow label="Excluded">
          {offers.map((offer) => (
            <CompareCell key={offer.id}>
              <ScopeItems
                items={offer.excluded}
                emptyText="No exclusions listed"
                tone="excluded"
              />
            </CompareCell>
          ))}
        </CompareRow>

        <CompareRow label="Material allowance">
          {offers.map((offer) => (
            <CompareCell key={offer.id}>
              <LongText value={offer.materialAllowance} empty="No material allowance listed" />
            </CompareCell>
          ))}
        </CompareRow>

        <CompareRow label="Assumptions">
          {offers.map((offer) => (
            <CompareCell key={offer.id}>
              <LongText value={offer.assumptions} empty="No assumptions listed" />
            </CompareCell>
          ))}
        </CompareRow>

        <CompareRow label="Risk notes">
          {offers.map((offer) => (
            <CompareCell key={offer.id}>
              <LongText value={offer.riskNotes} empty="No risk notes listed" />
            </CompareCell>
          ))}
        </CompareRow>

        <CompareRow label="Warranty">
          {offers.map((offer) => (
            <CompareCell key={offer.id}>
              <LongText value={offer.warranty} empty="No warranty listed" />
            </CompareCell>
          ))}
        </CompareRow>

        <CompareRow label="Notes">
          {offers.map((offer) => (
            <CompareCell key={offer.id}>
              <ScopeItems
                items={offer.notes}
                emptyText="No additional notes"
                tone="notes"
              />
            </CompareCell>
          ))}
        </CompareRow>

        <CompareRow label="Action">
          {offers.map((offer) => (
            <CompareCell key={offer.id}>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/messages/${offer.projectId}/${offer.contractorId}`}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-200"
                >
                  Deal room
                </Link>

                {['pending', 'countered'].includes(offer.status) && (
                  <Link
                    href={`/dashboard/messages/${offer.projectId}/${offer.contractorId}`}
                    className="rounded-full bg-[#f45112] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[#d94406]"
                  >
                    Negotiate
                  </Link>
                )}

                {offer.status === 'payment_pending' && (
                  <Link
                    href={`/dashboard/checkout/project/${offer.projectId}`}
                    className="rounded-full bg-[#f4510b] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[#d94406]"
                  >
                    Checkout
                  </Link>
                )}
              </div>
            </CompareCell>
          ))}
        </CompareRow>
      </div>
    </div>
  );
}

function ConditionGrid({ offer }: { offer: CompareOffer }) {
  return (
    <div className="grid gap-1.5">
      <ConditionPill label="Labor" value={offer.laborIncluded} />
      <ConditionPill label="Materials" value={offer.materialsIncluded} />
      <ConditionPill label="Cleanup" value={offer.cleanupIncluded} />
      <ConditionPill label="Permits" value={offer.permitsIncluded} />
      <ConditionPill label="Site visit" value={offer.siteVisitRequired} inverted />
    </div>
  );
}

function ConditionPill({
  label,
  value,
  inverted = false,
}: {
  label: string;
  value?: boolean;
  inverted?: boolean;
}) {
  const positive = Boolean(value);
  const good = inverted ? !positive : positive;

  return (
    <div
      className={[
        'flex items-center justify-between rounded-xl border px-3 py-2 text-xs',
        good
          ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
          : 'border-amber-100 bg-amber-50 text-amber-800',
      ].join(' ')}
    >
      <span className="font-bold">{label}</span>
      <span className="font-black">{positive ? 'Yes' : 'No'}</span>
    </div>
  );
}

function TinyFlag({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value || value === 'none') return null;

  const verified = value === 'verified';

  return (
    <span
      className={[
        'rounded-full px-2 py-0.5 text-[9px] font-black',
        verified
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-slate-100 text-slate-600',
      ].join(' ')}
    >
      {label}: {readableStatus(value)}
    </span>
  );
}

function MiniColumn({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-0.5 truncate text-sm font-black text-[#0f172a]">
        {value}
      </p>
    </div>
  );
}

function TextValue({
  value,
  empty = 'Not specified',
}: {
  value?: string | null;
  empty?: string;
}) {
  if (!value) {
    return <span className="text-xs text-slate-400">{empty}</span>;
  }

  return (
    <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
      {value}
    </p>
  );
}

function LongText({
  value,
  empty,
}: {
  value?: string | null;
  empty: string;
}) {
  if (!value) {
    return <span className="text-xs text-slate-400">{empty}</span>;
  }

  return (
    <p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">
      {value}
    </p>
  );
}

function TrustLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="text-right font-black text-[#0f172a]">{value}</span>
    </div>
  );
}

function PanelHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex min-h-[60px] items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-black text-[#0f172a]">
          {title}
        </h2>

        <p className="mt-0.5 truncate text-xs text-slate-500">
          {subtitle}
        </p>
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function CompareRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const count = Math.max(Children.count(children), 1);

  return (
    <div
      className="grid border-b border-slate-100 last:border-b-0"
      style={{
        gridTemplateColumns: `180px repeat(${count}, minmax(260px, 1fr))`,
      }}
    >
      <div className="border-r border-slate-200 bg-slate-50 px-4 py-4">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
          {label}
        </p>
      </div>

      {children}
    </div>
  );
}

function CompareCell({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 border-r border-slate-100 px-4 py-4 last:border-r-0">
      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-0.5 truncate text-xs font-black text-[#0f172a]">
        {value}
      </p>
    </div>
  );
}

function MetricPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <span
      className={[
        'rounded-full px-2.5 py-1 text-[11px] font-black',
        accent
          ? 'bg-orange-50 text-orange-700'
          : 'bg-slate-100 text-slate-600',
      ].join(' ')}
    >
      {label}: {value}
    </span>
  );
}

function ScopeItems({
  items,
  emptyText,
  tone,
}: {
  items: string[];
  emptyText: string;
  tone: 'included' | 'excluded' | 'notes';
}) {
  if (!items.length) {
    return <span className="text-xs text-slate-400">{emptyText}</span>;
  }

  const mark = tone === 'included' ? '✓' : tone === 'excluded' ? '–' : '•';

  const markClass =
    tone === 'included'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'excluded'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-slate-100 text-slate-600';

  return (
    <ul className="space-y-1.5">
      {items.slice(0, 8).map((item, index) => (
        <li key={index} className="flex gap-2">
          <span
            className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-black ${markClass}`}
          >
            {mark}
          </span>

          <span className="text-xs leading-5 text-slate-700">
            {item}
          </span>
        </li>
      ))}

      {items.length > 8 && (
        <li className="pl-6 text-xs font-bold text-slate-400">
          +{items.length - 8} more
        </li>
      )}
    </ul>
  );
}

function FilterPill({
  current,
  value,
  onClick,
  children,
}: {
  current: string;
  value: FilterValue;
  onClick: (value: FilterValue) => void;
  children: ReactNode;
}) {
  const active = current === value;

  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={[
        'rounded-full px-3 py-1.5 text-[11px] font-black transition',
        active
          ? 'bg-[#f4510b] text-white shadow-sm'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function StatusBadge({
  status,
  compact = false,
}: {
  status: string;
  compact?: boolean;
}) {
  const label = readableStatus(status);

  const className =
    status === 'accepted'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'payment_pending'
        ? 'bg-orange-100 text-orange-700'
        : status === 'rejected' || status === 'expired'
          ? 'bg-slate-200 text-slate-600'
          : status === 'countered'
            ? 'bg-amber-100 text-amber-800'
            : 'bg-blue-100 text-blue-700';

  return (
    <span
      className={[
        'inline-flex w-fit max-w-[140px] truncate rounded-full font-black capitalize',
        compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]',
        className,
      ].join(' ')}
    >
      {label}
    </span>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <div>
        <h3 className="text-sm font-black text-[#0f172a]">
          {title}
        </h3>

        <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
          {text}
        </p>
      </div>
    </div>
  );
}

function readableOfferType(value?: string | null): string {
  if (!value) return 'Not specified';
  if (value === 'fixed_price') return 'Fixed price';
  if (value === 'estimate_based_on_details') return 'Estimate based on details';
  if (value === 'final_after_site_visit') return 'Final after site visit';
  if (value === 'labor_only') return 'Labor only';
  if (value === 'labor_and_materials') return 'Labor + materials';

  return readableStatus(value);
}

function readableStatus(status: string): string {
  if (!status) return 'Unknown';
  if (status === 'payment_pending') return 'Payment pending';
  if (status === 'countered') return 'Countered';
  if (status === 'pending') return 'Pending';

  return status.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase());
}
function ratingNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) return 0;

  const parsed = Number.parseFloat(String(value).replace(',', '.'));

  return Number.isFinite(parsed) ? parsed : 0;
}

async function notifyMarketplace(
  event: string,
  payload: Record<string, string>,
) {
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event, ...payload }),
    });
  } catch (error) {
    console.error('Marketplace notification error:', error);
    }
}
