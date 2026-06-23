'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import { COMMITMENT_FEE_PCT, commitmentFee } from '@/lib/fees';

interface Props {
  projectId: string;
  contractorId: string;
  homeownerId: string;
}

const CONTRACTOR_FEE_PERCENT = Math.round(COMMITMENT_FEE_PCT * 100);

type OfferType =
  | 'fixed_price'
  | 'estimate_based_on_details'
  | 'final_after_site_visit'
  | 'labor_only'
  | 'labor_and_materials';

export default function OfferForm({
  projectId,
  contractorId,
  homeownerId,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('');
  const [earliestStartDate, setEarliestStartDate] = useState('');
  const [offerType, setOfferType] = useState<OfferType>('estimate_based_on_details');

  const [includedScope, setIncludedScope] = useState('');
  const [excludedScope, setExcludedScope] = useState('');
  const [materialAllowance, setMaterialAllowance] = useState('');
  const [warranty, setWarranty] = useState('');
  const [assumptions, setAssumptions] = useState('');
  const [riskNotes, setRiskNotes] = useState('');
  const [notes, setNotes] = useState('');

  const [materialsIncluded, setMaterialsIncluded] = useState(true);
  const [laborIncluded, setLaborIncluded] = useState(true);
  const [cleanupIncluded, setCleanupIncluded] = useState(true);
  const [permitsIncluded, setPermitsIncluded] = useState(false);
  const [siteVisitRequired, setSiteVisitRequired] = useState(true);

  const [policyAccepted, setPolicyAccepted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const numericAmount = Number(amount);

  const contractorFeeAmount =
    numericAmount && numericAmount > 0
      ? commitmentFee(numericAmount)
      : 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const cleanAmount = Number(amount);
    const numericDays = days ? Number(days) : null;

    if (!cleanAmount || cleanAmount <= 0) {
      setError('Please enter a valid offer amount.');
      return;
    }

    if (numericDays !== null && (!numericDays || numericDays <= 0)) {
      setError('Please enter a valid timeline or leave it empty.');
      return;
    }

    if (!includedScope.trim()) {
      setError('Please describe what is included in this offer.');
      return;
    }

    if (!excludedScope.trim()) {
      setError('Please describe what is excluded from this offer.');
      return;
    }

    if (!materialAllowance.trim()) {
      setError('Please add material allowance or explain material assumptions.');
      return;
    }

    if (!assumptions.trim()) {
      setError('Please add assumptions. Example: based on uploaded photos, no hidden damage, no major code issues.');
      return;
    }

    if (!policyAccepted) {
      setError(
        'Please accept bidAI communication and contractor commitment terms before sending this offer.',
      );
      return;
    }

    setBusy(true);

    const includedItems = splitScopeItems(includedScope);
    const excludedItems = splitScopeItems(excludedScope);
    const cleanNotes = notes.trim();
    const cleanMaterialAllowance = materialAllowance.trim();
    const cleanWarranty = warranty.trim();
    const cleanAssumptions = assumptions.trim();
    const cleanRiskNotes = riskNotes.trim();
    const now = new Date().toISOString();

    const calculatedContractorFee = commitmentFee(cleanAmount);

    const scopeSummary = [
      'Included:',
      ...includedItems.map((item) => `- ${item}`),
      '',
      'Excluded:',
      ...excludedItems.map((item) => `- ${item}`),
      '',
      'Material allowance:',
      cleanMaterialAllowance,
      '',
      'Assumptions:',
      cleanAssumptions,
      '',
      'Risk notes:',
      cleanRiskNotes || 'No additional risk notes listed.',
      '',
      'Warranty:',
      cleanWarranty || 'No warranty listed.',
      '',
      'Notes:',
      cleanNotes || 'No additional notes.',
    ].join('\n');

    const { data: existingConversation, error: existingConversationError } =
      await supabase
        .from('conversations')
        .select('id')
        .eq('project_id', projectId)
        .eq('homeowner_id', homeownerId)
        .eq('contractor_id', contractorId)
        .maybeSingle();

    if (existingConversationError) {
      setError(existingConversationError.message);
      setBusy(false);
      return;
    }

    let conversationId = existingConversation?.id ?? null;

    if (!conversationId) {
      const { data: createdConversation, error: conversationError } =
        await supabase
          .from('conversations')
          .insert({
            project_id: projectId,
            homeowner_id: homeownerId,
            contractor_id: contractorId,
            last_message_at: now,
          })
          .select('id')
          .single();

      if (conversationError || !createdConversation) {
        setError(
          conversationError?.message ??
            'Could not create a conversation for this offer.',
        );
        setBusy(false);
        return;
      }

      conversationId = createdConversation.id;
    }

    /**
     * Close previous pending offers inside this conversation.
     * This prevents multiple active contractor offers from the same contractor
     * confusing the homeowner compare/checkout flow.
     */
    const { error: closeOldOffersError } = await supabase
      .from('offers')
      .update({
        status: 'countered',
        responded_at: now,
      })
      .eq('conversation_id', conversationId)
      .eq('status', 'pending');

    if (closeOldOffersError) {
      setError(closeOldOffersError.message);
      setBusy(false);
      return;
    }

    const offerPayload = {
      project_id: projectId,
      conversation_id: conversationId,
      parent_offer_id: null,

      sender_id: contractorId,
      sender_role: 'contractor',

      recipient_id: homeownerId,
      recipient_role: 'homeowner',

      kind: 'contractor_offer',
      amount: cleanAmount,
      timeline_days: numericDays,

      scope_summary: scopeSummary,
      included_items: includedItems,
      excluded_items: excludedItems,
      notes: cleanNotes || null,

      included_scope: includedScope.trim(),
      excluded_scope: excludedScope.trim(),
      material_allowance: cleanMaterialAllowance,
      assumptions: cleanAssumptions,
      risk_notes: cleanRiskNotes || null,
      warranty: cleanWarranty || null,

      offer_type: offerType,
      earliest_start_date: earliestStartDate || null,
      materials_included: materialsIncluded,
      labor_included: laborIncluded,
      cleanup_included: cleanupIncluded,
      permits_included: permitsIncluded,
      site_visit_required: siteVisitRequired,

      message: JSON.stringify({
        type: 'contractor_offer',
        message:
          cleanNotes ||
          `I reviewed the full project brief and can complete it for ${formatCurrency(
            cleanAmount,
          )}.`,
        included: includedItems,
        excluded: excludedItems,
        material_allowance: cleanMaterialAllowance,
        assumptions: cleanAssumptions,
        risk_notes: cleanRiskNotes || null,
        warranty: cleanWarranty || null,
        offer_type: offerType,
        earliest_start_date: earliestStartDate || null,
        materials_included: materialsIncluded,
        labor_included: laborIncluded,
        cleanup_included: cleanupIncluded,
        permits_included: permitsIncluded,
        site_visit_required: siteVisitRequired,
        notes: cleanNotes || null,
      }),

      status: 'pending',

      contractor_fee_percent: CONTRACTOR_FEE_PERCENT,
      contractor_fee_amount: calculatedContractorFee,
      contractor_fee_status: 'authorized',
      contractor_fee_authorized: true,
      contractor_fee_authorized_at: now,
    };

    const { data: createdOffer, error: insertError } = await supabase
      .from('offers')
      .insert(offerPayload)
      .select(
        `
        id,
        amount,
        timeline_days,
        included_items,
        excluded_items,
        notes,
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
        contractor_fee_status
      `,
      )
      .single();

    if (insertError || !createdOffer) {
      setError(insertError?.message ?? 'Could not create contractor offer.');
      setBusy(false);
      return;
    }

    const offerMessage = [
      `Contractor offer: ${formatCurrency(Number(createdOffer.amount))}`,
      createdOffer.timeline_days
        ? `Estimated timeline: ${createdOffer.timeline_days} days.`
        : 'Estimated timeline: TBD.',
      createdOffer.earliest_start_date
        ? `Earliest start: ${createdOffer.earliest_start_date}.`
        : null,
      '',
      'Included:',
      ...includedItems.map((item) => `- ${item}`),
      '',
      'Excluded:',
      ...excludedItems.map((item) => `- ${item}`),
      '',
      'Material allowance:',
      cleanMaterialAllowance,
      '',
      'Assumptions:',
      cleanAssumptions,
      '',
      'Risk notes:',
      cleanRiskNotes || 'No additional risk notes listed.',
      '',
      'Warranty:',
      cleanWarranty || 'No warranty listed.',
      '',
      'Offer conditions:',
      `- Offer type: ${readableOfferType(offerType)}`,
      `- Labor included: ${laborIncluded ? 'Yes' : 'No'}`,
      `- Materials included: ${materialsIncluded ? 'Yes' : 'No'}`,
      `- Cleanup included: ${cleanupIncluded ? 'Yes' : 'No'}`,
      `- Permits included: ${permitsIncluded ? 'Yes' : 'No'}`,
      `- Site visit required: ${siteVisitRequired ? 'Yes' : 'No'}`,
      '',
      'Notes:',
      cleanNotes || 'No additional notes.',
      '',
      'Platform terms:',
      `- If this offer is accepted and paid by the homeowner, bidAI will charge a ${CONTRACTOR_FEE_PERCENT}% contractor commitment fee from your saved payment method.`,
      '- All communication and payment must stay inside bidAI.',
      '- Sharing phone numbers, emails, social media accounts, external payment links, or trying to move the project off-platform may permanently suspend the account.',
    ]
      .filter((line) => line !== null)
      .join('\n');

    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: contractorId,
      content: offerMessage,
      kind: 'offer_card',
      offer_id: createdOffer.id,
    });

    if (messageError) {
      setError(messageError.message);
      setBusy(false);
      return;
    }

    await supabase
      .from('conversations')
      .update({
        last_message_at: now,
      })
      .eq('id', conversationId);

    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({
        status: 'negotiating',
        selected_offer_id: null,
        awarded_offer_id: null,
      })
      .eq('id', projectId)
      .in('status', [
        'open',
        'in_review',
        'quoted',
        'negotiating',
        'expired',
        // NOTE: 'pending_payment' is intentionally excluded — a homeowner already
        // in the checkout window must not have their project reset back to
        // negotiating by a late contractor offer.
      ]);

    if (projectUpdateError) {
      setError(projectUpdateError.message);
      setBusy(false);
      return;
    }

    await notifyMarketplace('offer_created', { offerId: createdOffer.id });

    setBusy(false);

    /**
     * Chat/deal room can stay visually locked until payment,
     * but the offer card is created there for later continuity.
     */
    router.push(`/dashboard/messages/${projectId}/${homeownerId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-lg border border-orange-100 bg-orange-50 px-4 py-3">
        <div className="text-xs font-black uppercase tracking-wide text-orange-800">
          Detailed offer required
        </div>

        <p className="mt-1 text-sm leading-6 text-orange-950/80">
          The homeowner cannot chat before checkout. Your offer must clearly define
          price, scope, exclusions, material assumptions, risk notes, warranty and
          whether a site visit may change the final price.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Offer amount ($)"
          type="number"
          min={1}
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />

        <Input
          label="Timeline (days)"
          type="number"
          min={1}
          value={days}
          onChange={(event) => setDays(event.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Earliest start date"
          type="date"
          value={earliestStartDate}
          onChange={(event) => setEarliestStartDate(event.target.value)}
        />

        <Select
          label="Offer type"
          required
          value={offerType}
          onChange={(event) => setOfferType(event.target.value as OfferType)}
        >
          <option value="fixed_price">Fixed price</option>
          <option value="estimate_based_on_details">Estimate based on provided details</option>
          <option value="final_after_site_visit">Final after site visit</option>
          <option value="labor_only">Labor only</option>
          <option value="labor_and_materials">Labor + materials</option>
        </Select>
      </div>

      <Textarea
        label="Included scope"
        placeholder={`Example:
- Demolition of existing cabinets
- Cabinet installation
- Quartz countertop installation
- Basic plumbing connection
- Jobsite cleanup`}
        required
        value={includedScope}
        onChange={(event) => setIncludedScope(event.target.value)}
      />

      <Textarea
        label="Excluded scope"
        placeholder={`Example:
- Permit fees
- Appliances
- Hidden water or mold damage
- Electrical panel upgrade
- Premium material upgrades above allowance`}
        required
        value={excludedScope}
        onChange={(event) => setExcludedScope(event.target.value)}
      />

      <Textarea
        label="Material allowance"
        placeholder={`Example:
Cabinets: up to $8,000
Countertops: up to $4,500
Flooring: up to $2,500
Fixtures: up to $800

Any material selected above allowance requires homeowner approval.`}
        required
        value={materialAllowance}
        onChange={(event) => setMaterialAllowance(event.target.value)}
      />

      <Textarea
        label="Assumptions"
        placeholder={`Example:
This offer is based on the uploaded photos and project brief.
No structural changes are included unless stated.
No hidden water damage, mold, code violations or major electrical issues are assumed.`}
        required
        value={assumptions}
        onChange={(event) => setAssumptions(event.target.value)}
      />

      <Textarea
        label="Risk notes"
        placeholder={`Example:
Final price may change if hidden damage, plumbing relocation, electrical panel issues, permit requirements or structural problems are discovered.`}
        value={riskNotes}
        onChange={(event) => setRiskNotes(event.target.value)}
      />

      <Textarea
        label="Warranty"
        placeholder="Example: 1-year workmanship warranty. Manufacturer warranties depend on selected materials."
        value={warranty}
        onChange={(event) => setWarranty(event.target.value)}
      />

      <Textarea
        label="Additional notes"
        placeholder="Add payment schedule, crew availability, special instructions, or anything else the homeowner should know."
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 text-sm font-black text-[#0f172a]">
          Offer conditions
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <CheckboxRow
            label="Labor included"
            checked={laborIncluded}
            onChange={setLaborIncluded}
          />

          <CheckboxRow
            label="Materials included"
            checked={materialsIncluded}
            onChange={setMaterialsIncluded}
          />

          <CheckboxRow
            label="Cleanup included"
            checked={cleanupIncluded}
            onChange={setCleanupIncluded}
          />

          <CheckboxRow
            label="Permits included"
            checked={permitsIncluded}
            onChange={setPermitsIncluded}
          />

          <CheckboxRow
            label="Site visit required before final confirmation"
            checked={siteVisitRequired}
            onChange={setSiteVisitRequired}
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#0f172a]">
            <ShieldIcon />
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-black text-[#0f172a]">
              Marketplace commitment
            </h3>

            <p className="mt-1 text-xs leading-5 text-slate-600">
              No payment is charged when you submit this offer. If the homeowner
              accepts this offer and completes checkout, bidAI will charge a{' '}
              <span className="font-black">
                {CONTRACTOR_FEE_PERCENT}% contractor commitment fee
              </span>{' '}
              from your saved payment method.
            </p>

            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-slate-500">
                  Estimated commitment fee
                </span>

                <span className="font-black text-[#0f172a]">
                  {contractorFeeAmount
                    ? formatCurrency(contractorFeeAmount)
                    : 'Enter amount'}
                </span>
              </div>

              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Triggered only after homeowner acceptance and completed checkout.
              </p>
            </div>

            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <input
                type="checkbox"
                checked={policyAccepted}
                onChange={(event) => setPolicyAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 accent-[#f4510b]"
              />

              <span className="text-xs font-medium leading-5 text-slate-600">
                I agree to keep all communication and payments inside bidAI, and
                I authorize the {CONTRACTOR_FEE_PERCENT}% contractor commitment
                fee if this offer is accepted and paid by the homeowner. I
                understand that moving the project off-platform may permanently
                suspend my account.
              </span>
            </label>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending...' : 'Send detailed offer'}
        </Button>
      </div>
    </form>
  );
}

async function notifyMarketplace(event: string, payload: Record<string, string>) {
  await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, ...payload }),
  }).catch(() => undefined);
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-[#f4510b]"
      />

      <span className="text-xs font-bold leading-5 text-slate-700">
        {label}
      </span>
    </label>
  );
}

function splitScopeItems(value: string): string[] {
  if (!value?.trim()) return [];

  return value
    .split(/\n|,|;|•/)
    .map((item) => item.replace(/^[-–—]\s*/, '').trim())
    .filter(Boolean);
}

function readableOfferType(value: OfferType) {
  if (value === 'fixed_price') return 'Fixed price';
  if (value === 'estimate_based_on_details') return 'Estimate based on provided details';
  if (value === 'final_after_site_visit') return 'Final after site visit';
  if (value === 'labor_only') return 'Labor only';
  if (value === 'labor_and_materials') return 'Labor + materials';

  return value;
}

function ShieldIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
           />

      <path
        d="m9 12 2 2 4-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
