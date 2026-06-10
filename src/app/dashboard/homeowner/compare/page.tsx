import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { countUnreadConversations } from '@/lib/unread';
import CompareBoard from './compare-board';

export default async function HomeownerComparePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: projects, error: projectsError }, messageCount] =
    await Promise.all([
      supabase
        .from('projects')
        .select(`
          id,
          title,
          status,
          zip_code,
          created_at,
          ai_estimate_min,
          ai_estimate_max,
          budget_min,
          budget_max,
          selected_offer_id,
          awarded_offer_id,
          categories(name)
        `)
        .eq('homeowner_id', user.id)
        .order('created_at', { ascending: false }),

      countUnreadConversations(supabase, user.id, 'homeowner'),
    ]);

  if (projectsError) {
    console.error('Compare projects query error:', projectsError);
    throw new Error(projectsError.message);
  }

  const projectRows = (projects ?? []) as any[];
  const projectIds = projectRows.map((project) => project.id);

  let offerRows: any[] = [];

  if (projectIds.length > 0) {
    const { data, error } = await supabase
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
        notes,
        message,

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

        contractor_fee_amount,
        contractor_fee_status,
        accepted_at,
        rejected_at,
        expired_at,
        responded_at,
        created_at
      `)
      .in('project_id', projectIds)
      .in('status', [
        'pending',
        'countered',
        'payment_pending',
        'accepted',
      ])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Compare offers query error:', error);
      throw new Error(error.message);
    }

    offerRows = data ?? [];
  }

  const contractorIds = Array.from(
    new Set(
      offerRows
        .map((offer) => getContractorIdFromOffer(offer))
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const { data: contractorProfiles, error: contractorError } =
    contractorIds.length > 0
      ? await supabase
          .from('contractor_profiles')
          .select(`
            user_id,
            company_name,
            rating_avg,
            rating_count,
            verified,
            bio,
            years_in_business,
            completed_jobs_count,
            response_time_hours,
            license_status,
            insurance_status
          `)
          .in('user_id', contractorIds)
      : { data: [], error: null };

  if (contractorError) {
    console.error('Contractor profiles query error:', contractorError);
    throw new Error(contractorError.message);
  }

  const contractorById = new Map<string, any>(
    ((contractorProfiles ?? []) as any[]).map((contractor) => [
      contractor.user_id,
      contractor,
    ]),
  );

  const compareProjects = projectRows.map((project: any) => {
    const projectOffers = offerRows.filter(
      (offer) => offer.project_id === project.id,
    );

    const activeOffers = projectOffers.filter((offer) =>
      ['pending', 'countered', 'payment_pending', 'accepted'].includes(
        String(offer.status),
      ),
    );

    return {
      id: String(project.id),
      title: String(project.title ?? 'Untitled project'),
      status: String(project.status ?? 'open'),
      zipCode: project.zip_code ?? null,
      category: firstRow<any>(project.categories)?.name ?? 'Renovation',
      createdAt: String(project.created_at),
      aiEstimateMin: project.ai_estimate_min,
      aiEstimateMax: project.ai_estimate_max,
      budgetMin: project.budget_min,
      budgetMax: project.budget_max,
      offerCount: activeOffers.length,
      selectedOfferId: project.selected_offer_id ?? null,
      awardedOfferId: project.awarded_offer_id ?? null,
    };
  });

  const compareOffers = offerRows
    .map((offer: any) => {
      const contractorId = getContractorIdFromOffer(offer);

      if (!contractorId) {
        return null;
      }

      const contractor = contractorById.get(contractorId);

      const parsedMessage = parseOfferJsonMessage(offer.message);
      const parsedScope = parseScopeSummary(offer.scope_summary);

      const includedItems = normalizeItems(
        offer.included_items || offer.included_scope,
      );

      const excludedItems = normalizeItems(
        offer.excluded_items || offer.excluded_scope,
      );

      const noteItems = normalizeItems(offer.notes);

      const included =
        includedItems.length > 0
          ? includedItems
          : parsedMessage.included.length > 0
            ? parsedMessage.included
            : parsedScope.included;

      const excluded =
        excludedItems.length > 0
          ? excludedItems
          : parsedMessage.excluded.length > 0
            ? parsedMessage.excluded
            : parsedScope.excluded;

      const notes =
        noteItems.length > 0
          ? noteItems
          : parsedMessage.message
            ? [parsedMessage.message]
            : [];

      const materialAllowance =
        stringOrNull(offer.material_allowance) ??
        stringOrNull(parsedMessage.materialAllowance) ??
        parsedScope.materialAllowance ??
        null;

      const assumptions =
        stringOrNull(offer.assumptions) ??
        stringOrNull(parsedMessage.assumptions) ??
        parsedScope.assumptions ??
        null;

      const riskNotes =
        stringOrNull(offer.risk_notes) ??
        stringOrNull(parsedMessage.riskNotes) ??
        parsedScope.riskNotes ??
        null;

      const warranty =
        stringOrNull(offer.warranty) ??
        stringOrNull(parsedMessage.warranty) ??
        parsedScope.warranty ??
        null;

      return {
        id: String(offer.id),
        projectId: String(offer.project_id),
        contractorId,
        conversationId: offer.conversation_id ? String(offer.conversation_id) : null,

        senderId: String(offer.sender_id),
        senderRole: offer.sender_role as 'homeowner' | 'contractor',
        recipientId: offer.recipient_id ? String(offer.recipient_id) : null,
        recipientRole: offer.recipient_role as
          | 'homeowner'
          | 'contractor'
          | null,

        kind: String(offer.kind ?? 'offer'),
        company: contractor?.company_name ?? 'Contractor',

        amount: Number(offer.amount ?? 0),
        timelineDays:
          typeof offer.timeline_days === 'number'
            ? offer.timeline_days
            : offer.timeline_days
              ? Number(offer.timeline_days)
              : null,

        status: String(offer.status ?? 'pending'),

        rating:
          contractor?.rating_count > 0
            ? Number(contractor.rating_avg).toFixed(1)
            : 'New',
        reviewCount: contractor?.rating_count ?? 0,
        verified: Boolean(contractor?.verified),
        bio: contractor?.bio ?? null,
        yearsInBusiness: contractor?.years_in_business ?? null,
        completedJobsCount: contractor?.completed_jobs_count ?? null,
        responseTimeHours: contractor?.response_time_hours ?? null,
        licenseStatus: contractor?.license_status ?? null,
        insuranceStatus: contractor?.insurance_status ?? null,

        createdAt: String(offer.created_at),
        acceptedAt: offer.accepted_at ?? null,
        rejectedAt: offer.rejected_at ?? null,
        expiredAt: offer.expired_at ?? null,
        respondedAt: offer.responded_at ?? null,

        included,
        excluded,
        notes,

        materialAllowance,
        assumptions,
        riskNotes,
        warranty,
        offerType: offer.offer_type ?? parsedMessage.offerType ?? null,
        earliestStartDate:
          offer.earliest_start_date ?? parsedMessage.earliestStartDate ?? null,

        materialsIncluded:
          typeof offer.materials_included === 'boolean'
            ? offer.materials_included
            : Boolean(parsedMessage.materialsIncluded),

        laborIncluded:
          typeof offer.labor_included === 'boolean'
            ? offer.labor_included
            : parsedMessage.laborIncluded !== null
              ? Boolean(parsedMessage.laborIncluded)
              : true,

        cleanupIncluded:
          typeof offer.cleanup_included === 'boolean'
            ? offer.cleanup_included
            : parsedMessage.cleanupIncluded !== null
              ? Boolean(parsedMessage.cleanupIncluded)
              : true,

        permitsIncluded:
          typeof offer.permits_included === 'boolean'
            ? offer.permits_included
            : Boolean(parsedMessage.permitsIncluded),

        siteVisitRequired:
          typeof offer.site_visit_required === 'boolean'
            ? offer.site_visit_required
            : parsedMessage.siteVisitRequired !== null
              ? Boolean(parsedMessage.siteVisitRequired)
              : true,

        contractorFeeAmount: offer.contractor_fee_amount ?? null,
        contractorFeeStatus: offer.contractor_fee_status ?? null,
      };
    })
    .filter(isCompareOffer);

  const openOfferCount = compareOffers.filter((offer) =>
    ['pending', 'countered', 'payment_pending'].includes(offer.status),
  ).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role="homeowner"
          active="compare"
          messageCount={messageCount ?? 0}
          quoteCount={openOfferCount}
        />

        <main className="min-w-0 flex-1 overflow-hidden">
          <div className="mx-auto max-w-[1500px] px-5 py-4">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#f4510b]">
                  Decision center
                </p>

                <h1 className="mt-1 text-2xl font-black tracking-tight">
                  Compare detailed offers
                </h1>

                <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">
                  Compare contractor offers by price, timeline, included scope,
                  exclusions, material allowance, assumptions, warranty, permits
                  and site-visit conditions before moving to checkout.
                </p>
              </div>
            </div>

            <CompareBoard projects={compareProjects} offers={compareOffers} />
          </div>
        </main>
      </div>
    </div>
  );
}

function getContractorIdFromOffer(offer: any): string | null {
  if (offer.sender_role === 'contractor' && offer.sender_id) {
    return String(offer.sender_id);
  }

  if (offer.recipient_role === 'contractor' && offer.recipient_id) {
    return String(offer.recipient_id);
  }

  return null;
}

function parseOfferJsonMessage(message: string | null | undefined): {
  message: string | null;
  included: string[];
  excluded: string[];
  materialAllowance: string | null;
  assumptions: string | null;
  riskNotes: string | null;
  warranty: string | null;
  offerType: string | null;
  earliestStartDate: string | null;
  materialsIncluded: boolean | null;
  laborIncluded: boolean | null;
  cleanupIncluded: boolean | null;
  permitsIncluded: boolean | null;
  siteVisitRequired: boolean | null;
} {
  if (!message) {
    return emptyParsedMessage();
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

      materialAllowance:
        typeof parsed.material_allowance === 'string'
          ? parsed.material_allowance
          : typeof parsed.materialAllowance === 'string'
            ? parsed.materialAllowance
            : null,

      assumptions:
        typeof parsed.assumptions === 'string' ? parsed.assumptions : null,

      riskNotes:
        typeof parsed.risk_notes === 'string'
          ? parsed.risk_notes
          : typeof parsed.riskNotes === 'string'
            ? parsed.riskNotes
            : null,

      warranty:
        typeof parsed.warranty === 'string' ? parsed.warranty : null,

      offerType:
        typeof parsed.offer_type === 'string'
          ? parsed.offer_type
          : typeof parsed.offerType === 'string'
            ? parsed.offerType
            : null,

      earliestStartDate:
        typeof parsed.earliest_start_date === 'string'
          ? parsed.earliest_start_date
          : typeof parsed.earliestStartDate === 'string'
            ? parsed.earliestStartDate
            : null,

      materialsIncluded:
        typeof parsed.materials_included === 'boolean'
          ? parsed.materials_included
          : typeof parsed.materialsIncluded === 'boolean'
            ? parsed.materialsIncluded
            : null,

      laborIncluded:
        typeof parsed.labor_included === 'boolean'
          ? parsed.labor_included
          : typeof parsed.laborIncluded === 'boolean'
            ? parsed.laborIncluded
            : null,

      cleanupIncluded:
        typeof parsed.cleanup_included === 'boolean'
          ? parsed.cleanup_included
          : typeof parsed.cleanupIncluded === 'boolean'
            ? parsed.cleanupIncluded
            : null,

      permitsIncluded:
        typeof parsed.permits_included === 'boolean'
          ? parsed.permits_included
          : typeof parsed.permitsIncluded === 'boolean'
            ? parsed.permitsIncluded
            : null,

      siteVisitRequired:
        typeof parsed.site_visit_required === 'boolean'
          ? parsed.site_visit_required
          : typeof parsed.siteVisitRequired === 'boolean'
            ? parsed.siteVisitRequired
            : null,
    };
  } catch {
    return {
      ...emptyParsedMessage(),
      message,
    };
  }
}

function emptyParsedMessage() {
  return {
    message: null,
    included: [],
    excluded: [],
    materialAllowance: null,
    assumptions: null,
    riskNotes: null,
    warranty: null,
    offerType: null,
    earliestStartDate: null,
    materialsIncluded: null,
    laborIncluded: null,
    cleanupIncluded: null,
    permitsIncluded: null,
    siteVisitRequired: null,
  };
}

function parseScopeSummary(scopeSummary: string | null | undefined): {
  included: string[];
  excluded: string[];
  materialAllowance: string | null;
  assumptions: string | null;
  riskNotes: string | null;
  warranty: string | null;
} {
  if (!scopeSummary) {
    return {
      included: [],
      excluded: [],
      materialAllowance: null,
      assumptions: null,
      riskNotes: null,
      warranty: null,
    };
  }

  const lines = scopeSummary
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const included: string[] = [];
  const excluded: string[] = [];
  const materialAllowance: string[] = [];
  const assumptions: string[] = [];
  const riskNotes: string[] = [];
  const warranty: string[] = [];

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
    if (mode === 'material') materialAllowance.push(cleaned);
    if (mode === 'assumptions') assumptions.push(cleaned);
    if (mode === 'risk') riskNotes.push(cleaned);
    if (mode === 'warranty') warranty.push(cleaned);
  }

  return {
    included,
    excluded,
    materialAllowance: materialAllowance.length
      ? materialAllowance.join('\n')
      : null,
    assumptions: assumptions.length ? assumptions.join('\n') : null,
    riskNotes: riskNotes.length ? riskNotes.join('\n') : null,
    warranty: warranty.length ? warranty.join('\n') : null,
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

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const clean = value.trim();

  return clean ? clean : null;
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function isCompareOffer(value: any): value is {
  id: string;
  projectId: string;
  contractorId: string;
  conversationId: string | null;

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
  yearsInBusiness: number | null;
  completedJobsCount: number | null;
  responseTimeHours: number | null;
  licenseStatus: string | null;
  insuranceStatus: string | null;

  createdAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  expiredAt: string | null;
  respondedAt: string | null;

  included: string[];
  excluded: string[];
  notes: string[];

  materialAllowance: string | null;
  assumptions: string | null;
  riskNotes: string | null;
  warranty: string | null;
  offerType: string | null;
  earliestStartDate: string | null;

  materialsIncluded: boolean;
  laborIncluded: boolean;
  cleanupIncluded: boolean;
  permitsIncluded: boolean;
  siteVisitRequired: boolean;

  contractorFeeAmount: number | null;
  contractorFeeStatus: string | null;
} {
  return Boolean(
    value &&
      typeof value.id === 'string' &&
      typeof value.projectId === 'string' &&
      typeof value.contractorId === 'string',
  );
}