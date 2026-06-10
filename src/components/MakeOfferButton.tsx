'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';

interface MakeOfferButtonProps {
  projectId: string | null;
  projectTitle?: string | null;

  contractorId: string;
  contractorCompany: string;
  contractorRating?: number | null;
  contractorReviewCount?: number | null;
  contractorVerified?: boolean | null;
  contractorBio?: string | null;
  contractorServices?: string | null;

  typicalRangeMin?: number | null;
  typicalRangeMax?: number | null;
  aiEstimateMin?: number | null;
  aiEstimateMax?: number | null;

  /**
   * Used when an expired homeowner budget request is being created again.
   */
  initialAmount?: number | null;
  initialTimelineDays?: number | null;
  initialIncluded?: string[] | null;
  initialExcluded?: string[] | null;
  initialMessage?: string | null;

  variant?: 'primary' | 'secondary';
  className?: string;
  label?: string;
}

/**
 * Homeowner -> Contractor structured budget offer.
 *
 * Offers-centered model:
 * - Homeowner budget request = offers.kind = budget_offer
 * - Contractor offer = offers.kind = contractor_offer
 * - Counter offers also live in offers
 * - messages only display offer cards through messages.offer_id
 *
 * Before checkout:
 * - No free text chat
 * - Only structured offer cards
 *
 * After checkout:
 * - Direct chat can unlock based on project status
 */
export function MakeOfferButton(props: MakeOfferButtonProps) {
  const {
    projectId,
    projectTitle,
    contractorId,
    contractorCompany,
    contractorBio,
    contractorServices,
    typicalRangeMin,
    typicalRangeMax,
    aiEstimateMin,
    aiEstimateMax,
    initialAmount,
    initialTimelineDays,
    initialIncluded,
    initialExcluded,
    initialMessage,
    variant = 'primary',
    className,
    label = 'Ask with budget',
  } = props;

  const router = useRouter();
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  const [amount, setAmount] = useState('');
  const [timeline, setTimeline] = useState('');
  const [included, setIncluded] = useState('');
  const [excluded, setExcluded] = useState('');
  const [message, setMessage] = useState('');

  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showTypicalRange = Boolean(typicalRangeMin || typicalRangeMax);
  const showAiEstimate = Boolean(aiEstimateMin || aiEstimateMax);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
      }
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  const triggerClasses =
    variant === 'primary'
      ? 'rounded-xl bg-[#f4510b] px-3 py-2 text-center text-xs font-black text-white transition hover:bg-[#d94406]'
      : 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-black text-slate-900 transition hover:bg-slate-50';

  function reset() {
    setAmount('');
    setTimeline('');
    setIncluded('');
    setExcluded('');
    setMessage('');
    setError(null);
    setSent(false);
  }

  function close() {
    if (busy) return;

    setOpen(false);
    reset();
  }

  function openModal() {
    setAmount(initialAmount ? String(initialAmount) : '');
    setTimeline(initialTimelineDays ? String(initialTimelineDays) : '');
    setIncluded(initialIncluded?.length ? initialIncluded.join('\n') : '');
    setExcluded(initialExcluded?.length ? initialExcluded.join('\n') : '');
    setMessage(initialMessage ?? '');
    setError(null);
    setSent(false);
    setOpen(true);
  }

  function toLines(value: string) {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!projectId) {
      setError('You need an active project before sending a budget request.');
      return;
    }

    const numericAmount = Number(amount);
    const numericTimeline = timeline ? Number(timeline) : null;

    if (!numericAmount || numericAmount <= 0) {
      setError('Enter a valid budget amount.');
      return;
    }

    if (numericTimeline !== null && (!numericTimeline || numericTimeline <= 0)) {
      setError('Enter a valid timeline or leave it empty.');
      return;
    }

    const includedItems = toLines(included);
    const excludedItems = toLines(excluded);

    if (includedItems.length === 0) {
      setError('Add at least one included work item.');
      return;
    }

    setBusy(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError('You need to sign in to send a budget request.');
      setBusy(false);
      return;
    }

    const now = new Date().toISOString();

    const cleanMessage =
      message.trim() ||
      `Hi, I have a ${
        projectTitle ?? 'renovation'
      } project. My budget is around ${formatCurrency(
        numericAmount,
      )}. Can you review the scope and let me know if you can do it?`;

    const scopeSummary = [
      'Included:',
      ...includedItems.map((item) => `- ${item}`),
      excludedItems.length ? '' : null,
      excludedItems.length ? 'Excluded:' : null,
      ...excludedItems.map((item) => `- ${item}`),
    ]
      .filter(Boolean)
      .join('\n');

    /**
     * 1. Find or create the conversation container.
     * This is a negotiation room, not unlocked direct chat.
     */
    let conversationId: string | null = null;

    const { data: existingConversation, error: existingConversationError } =
      await supabase
        .from('conversations')
        .select('id')
        .eq('project_id', projectId)
        .eq('homeowner_id', user.id)
        .eq('contractor_id', contractorId)
        .maybeSingle();

    if (existingConversationError) {
      setError(existingConversationError.message);
      setBusy(false);
      return;
    }

    if (existingConversation?.id) {
      conversationId = existingConversation.id;
    } else {
      const { data: createdConversation, error: conversationError } =
        await supabase
          .from('conversations')
          .insert({
            project_id: projectId,
            homeowner_id: user.id,
            contractor_id: contractorId,
            last_message_at: now,
          })
          .select('id')
          .single();

      if (conversationError || !createdConversation) {
        setError(
          conversationError?.message ??
            'Could not create a negotiation request for this contractor.',
        );
        setBusy(false);
        return;
      }

      conversationId = createdConversation.id;
    }

    /**
     * 2. Close older pending offers in this conversation.
     * A new homeowner budget offer becomes the active pending offer.
     */
    const { error: closePendingError } = await supabase
      .from('offers')
      .update({
        status: 'countered',
        responded_at: now,
      })
      .eq('conversation_id', conversationId)
      .eq('status', 'pending');

    if (closePendingError) {
      setError(closePendingError.message);
      setBusy(false);
      return;
    }

    /**
     * 3. Create fresh homeowner budget offer.
     */
    const { data: createdOffer, error: offerError } = await supabase
      .from('offers')
      .insert({
        project_id: projectId,
        conversation_id: conversationId,
        parent_offer_id: null,

        sender_id: user.id,
        sender_role: 'homeowner',

        recipient_id: contractorId,
        recipient_role: 'contractor',

        kind: 'budget_offer',
        amount: numericAmount,
        timeline_days: numericTimeline,

        scope_summary: scopeSummary,
        included_items: includedItems,
        excluded_items: excludedItems,
        notes: null,

        message: JSON.stringify({
          type: 'budget_offer',
          message: cleanMessage,
          included: includedItems,
          excluded: excludedItems,
          notes: null,
        }),

        status: 'pending',
      })
      .select(
        `
        id,
        amount,
        timeline_days,
        included_items,
        excluded_items,
        notes,
        status
      `,
      )
      .single();

    if (offerError || !createdOffer) {
      setError(offerError?.message ?? 'Could not create the budget request.');
      setBusy(false);
      return;
    }

    /**
     * 4. Create visible offer card message.
     */
    const messageLines = [
      `Budget request: ${formatCurrency(numericAmount)}`,
      numericTimeline ? `Preferred timeline: ${numericTimeline} days` : null,
      '',
      cleanMessage,
      '',
      'Included:',
      ...includedItems.map((item) => `• ${item}`),
      excludedItems.length ? '' : null,
      excludedItems.length ? 'Excluded:' : null,
      ...excludedItems.map((item) => `• ${item}`),
      '',
      'Contractor can accept, counter, or decline this request.',
    ].filter(Boolean);

    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      kind: 'offer_card',
      content: messageLines.join('\n'),
      offer_id: createdOffer.id,
    });

    if (messageError) {
      setError(messageError.message);
      setBusy(false);
      return;
    }

    /**
     * 5. Update conversation timestamp.
     */
    const { error: conversationUpdateError } = await supabase
  .from('conversations')
  .update({
    last_message_at: now,
  })
  .eq('id', conversationId);

if (conversationUpdateError) {
  setError(conversationUpdateError.message);
  setBusy(false);
  return;
}

    /**
     * 6. Move project back into negotiation pipeline.
     */
    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({
        status: 'negotiating',
        selected_offer_id: null,
        awarded_offer_id: null,
      })
      .eq('id', projectId)
      .in('status', ['open', 'in_review', 'negotiating']);

    if (projectUpdateError) {
      setError(projectUpdateError.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    setSent(true);
    router.refresh();

    setTimeout(() => {
      setOpen(false);
      router.push(`/dashboard/messages/${projectId}/${contractorId}`);
    }, 600);
  }

  const modal =
    mounted && open
      ? createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-slate-950/60 px-4 py-6"
            role="dialog"
            aria-modal="true"
            onClick={close}
          >
            <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-center">
              <div
                className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                {/* Header */}
                <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#f4510b]">
                        Budget request
                      </p>

                      <h2 className="mt-2 text-2xl font-black leading-tight text-slate-900">
                        Ask {contractorCompany} with your budget
                      </h2>

                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        This sends a structured request first. Direct chat opens
                        only after the offer is accepted.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={close}
                      aria-label="Close"
                      disabled={busy}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {sent ? (
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                      <h3 className="text-base font-black text-emerald-800">
                        Budget request sent
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-emerald-700">
                        The contractor can now accept, decline, or counter your
                        request. Direct chat will open after the request is
                        accepted.
                      </p>

                      <div className="mt-4 flex justify-end">
                        <Button type="button" onClick={close}>
                          Done
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={submit}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    {/* Body */}
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                      <div className="space-y-4">
                        {projectTitle && (
                          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                            Project:{' '}
                            <span className="text-slate-900">
                              {projectTitle}
                            </span>
                          </div>
                        )}

                        {(showTypicalRange || showAiEstimate) && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {showTypicalRange && (
                              <div className="rounded-lg bg-orange-50 p-4 text-xs">
                                <div className="font-black uppercase tracking-wide text-[#c94106]">
                                  Typical range
                                </div>

                                <div className="mt-1 text-sm font-black text-slate-900">
                                  {formatCurrency(typicalRangeMin ?? 0)} –{' '}
                                  {formatCurrency(typicalRangeMax ?? 0)}
                                </div>

                                <p className="mt-1 text-[11px] text-slate-500">
                                  Based on this contractor’s past offers.
                                </p>
                              </div>
                            )}

                            {showAiEstimate && (
                              <div className="rounded-lg bg-emerald-50 p-4 text-xs">
                                <div className="font-black uppercase tracking-wide text-emerald-700">
                                  AI estimate
                                </div>

                                <div className="mt-1 text-sm font-black text-slate-900">
                                  {formatCurrency(aiEstimateMin ?? 0)} –{' '}
                                  {formatCurrency(aiEstimateMax ?? 0)}
                                </div>

                                <p className="mt-1 text-[11px] text-slate-500">
                                  For your project specifically.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {contractorBio && (
                          <p className="rounded-lg bg-white p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-200">
                            {contractorBio}
                          </p>
                        )}

                        {contractorServices && (
                          <div className="text-sm text-slate-500">
                            <span className="font-black text-slate-900">
                              Services:{' '}
                            </span>
                            {contractorServices}
                          </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                              Your budget ($)
                            </span>

                            <input
                              type="number"
                              min={1}
                              required
                              value={amount}
                              onChange={(event) =>
                                setAmount(event.target.value)
                              }
                              className="mt-2 block w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                              placeholder="e.g. 18000"
                            />
                          </label>

                          <label className="block">
                            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                              Preferred timeline
                            </span>

                            <input
                              type="number"
                              min={1}
                              value={timeline}
                              onChange={(event) =>
                                setTimeline(event.target.value)
                              }
                              className="mt-2 block w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                              placeholder="e.g. 30 days"
                            />
                          </label>
                        </div>

                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                            Included work
                          </span>

                          <textarea
                            value={included}
                            onChange={(event) =>
                              setIncluded(event.target.value)
                            }
                            rows={4}
                            required
                            className="mt-2 block w-full resize-y rounded-lg border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                            placeholder={`Example:
Demolition
Tile installation
Plumbing work
Vanity installation`}
                          />

                          <p className="mt-1 text-xs text-slate-400">
                            Write each included item on a new line.
                          </p>
                        </label>

                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                            Excluded work
                          </span>

                          <textarea
                            value={excluded}
                            onChange={(event) =>
                              setExcluded(event.target.value)
                            }
                            rows={3}
                            className="mt-2 block w-full resize-y rounded-lg border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                            placeholder={`Example:
Permits
Premium materials
Painting`}
                          />

                          <p className="mt-1 text-xs text-slate-400">
                            Optional, but useful for avoiding misunderstandings.
                          </p>
                        </label>

                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                            Message to contractor
                          </span>

                          <textarea
                            value={message}
                            onChange={(event) =>
                              setMessage(event.target.value)
                            }
                            rows={3}
                            className="mt-2 block w-full resize-y rounded-lg border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                            placeholder="Hi, I have a bathroom remodeling project. My budget is around $8,000. Can you review the scope and let me know if you can do it?"
                          />
                        </label>

                        {error && (
                          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                            {error}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="max-w-md text-xs leading-5 text-slate-500">
                          This will not open direct chat yet. The contractor
                          must accept, decline or counter first.
                        </p>

                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={close}
                            disabled={busy}
                          >
                            Cancel
                          </Button>

                          <Button type="submit" disabled={busy}>
                            {busy ? 'Sending...' : 'Send budget request'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={!projectId}
        className={[
          triggerClasses,
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {label}
      </button>

      {modal}
    </>
  );
}