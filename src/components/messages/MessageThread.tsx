// @ts-nocheck
'use client';

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, relativeTime } from '@/lib/utils';

interface Props {
  conversationId: string;
  currentUserId: string;
  currentUserRole: 'homeowner' | 'contractor';
  initialMessages: any[];
  offers: any[];
  projectStatus?: string | null;

  /**
   * Legacy prop. Parent pages may still pass it temporarily.
   * This component no longer uses quotes.
   */
  quote?: any | null;
}

/**
 * MVP value.
 * Long-term: this should come from backend config / admin settings.
 */
const PAYMENT_WINDOW_MINUTES = 60;

/**
 * Project lifecycle controls direct chat. Offers control negotiation.
 *
 * Chat unlocks only after the contractor pays the commitment fee and the
 * project becomes `in_progress`. While `paid` (homeowner paid, contractor
 * not committed) the thread stays in structured-offer-only mode.
 */
const CHAT_UNLOCKED_STATUSES = ['in_progress', 'completed'];

const LOCKED_PROJECT_STATUSES = [
  'pending_payment',
  'paid',
  'in_progress',
  'completed',
  'cancelled',
];

/**
 * Before checkout, users should only see structured marketplace messages.
 * Free text is unlocked after checkout.
 */
const PRE_PAYMENT_VISIBLE_MESSAGE_KINDS = ['system', 'offer_card'];

export default function MessageThread({
  conversationId,
  currentUserId,
  currentUserRole,
  initialMessages,
  offers,
  projectStatus,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [messages, setMessages] = useState(initialMessages ?? []);
  const [offerRows, setOfferRows] = useState(offers ?? []);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterTimeline, setCounterTimeline] = useState('');
  const [counterScope, setCounterScope] = useState('');

  const endRef = useRef<HTMLDivElement | null>(null);

  const normalizedProjectStatus = projectStatus ?? 'open';

  const isChatUnlocked = CHAT_UNLOCKED_STATUSES.includes(normalizedProjectStatus);
  const isLocked = LOCKED_PROJECT_STATUSES.includes(normalizedProjectStatus);
  const isCancelled = normalizedProjectStatus === 'cancelled';
  const isPendingPayment = normalizedProjectStatus === 'pending_payment';

  const sortedOffers = useMemo(
    () =>
      [...offerRows].sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime(),
      ),
    [offerRows],
  );

  const latestOffer = sortedOffers[0] ?? null;

  const pendingOffer =
    sortedOffers.find((offer) => offer.status === 'pending') ?? null;

  const expiredOffer =
    sortedOffers.find((offer) => offer.status === 'expired') ?? null;

  /**
   * Long-term preferred model:
   * - offers.status = accepted
   * - projects.status = pending_payment / paid / in_progress / completed
   *
   * Legacy support:
   * Some old rows may still use offers.status = payment_pending or paid.
   */
  const acceptedOffer =
    sortedOffers.find((offer) => offer.status === 'accepted') ??
    sortedOffers.find((offer) => offer.status === 'payment_pending') ??
    sortedOffers.find((offer) => offer.status === 'paid') ??
    null;

  const projectId =
    pendingOffer?.project_id ??
    acceptedOffer?.project_id ??
    expiredOffer?.project_id ??
    latestOffer?.project_id ??
    null;

  const hasActiveOffer = Boolean(pendingOffer || acceptedOffer);

  /**
   * Expiration belongs to offer rows.
   * Project status should not be "expired".
   */
  const hasExpiredDeal = Boolean(expiredOffer && !hasActiveOffer && !isLocked);

  const visibleMessages = useMemo(() => {
    if (isChatUnlocked) return messages;

    return messages.filter((message) =>
      PRE_PAYMENT_VISIBLE_MESSAGE_KINDS.includes(message.kind ?? 'text'),
    );
  }, [messages, isChatUnlocked]);

  const activeDeal = useMemo(() => {
    if (acceptedOffer) {
      return offerToDeal(
        acceptedOffer,
        normalizedProjectStatus === 'paid'
          ? 'Paid offer'
          : normalizedProjectStatus === 'pending_payment'
            ? 'Accepted offer'
            : 'Accepted offer',
      );
    }

    if (pendingOffer) {
      return offerToDeal(
        pendingOffer,
        pendingOffer.sender_role === 'homeowner'
          ? 'Homeowner budget offer'
          : 'Contractor offer',
      );
    }

    if (hasExpiredDeal && expiredOffer) {
      return offerToDeal(expiredOffer, 'Expired offer');
    }

    if (latestOffer) {
      return offerToDeal(
        latestOffer,
        latestOffer.sender_role === 'homeowner'
          ? 'Homeowner budget offer'
          : 'Contractor offer',
      );
    }

    return null;
  }, [
    acceptedOffer,
    pendingOffer,
    expiredOffer,
    latestOffer,
    hasExpiredDeal,
    normalizedProjectStatus,
  ]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.some((message) => message.id === payload.new.id)
              ? prev
              : [...prev, payload.new],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(`offers:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'offers',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setOfferRows((prev) =>
              prev.some((offer) => offer.id === payload.new.id)
                ? prev
                : [payload.new, ...prev],
            );
          }

          if (payload.eventType === 'UPDATE') {
            setOfferRows((prev) =>
              prev.map((offer) =>
                offer.id === payload.new.id
                  ? { ...offer, ...payload.new }
                  : offer,
              ),
            );
          }

          if (payload.eventType === 'DELETE') {
            setOfferRows((prev) =>
              prev.filter((offer) => offer.id !== payload.old.id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [visibleMessages, offerRows]);

  async function send(event: React.FormEvent) {
    event.preventDefault();

    if (!isChatUnlocked) {
      alert('Direct chat unlocks once the contractor commits to the job.');
      return;
    }

    const content = text.trim();
    if (!content) return;

    setBusy(true);
    setText('');

    const optimistic = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content,
      kind: 'text',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content,
        kind: 'text',
      })
      .select('*')
      .single();

    setBusy(false);

    if (error || !data) {
      setMessages((prev) =>
        prev.filter((message) => message.id !== optimistic.id),
      );

      // The database blocks off-platform contact details before checkout.
      const raw = error?.message ?? 'Send failed';
      const friendly = raw.includes('CONTACT_BLOCKED')
        ? raw.split('CONTACT_BLOCKED:').pop()!.trim()
        : raw;

      setText(content);
      alert(friendly);
      return;
    }

    setMessages((prev) =>
      prev.map((message) => (message.id === optimistic.id ? data : message)),
    );

    await notifyMarketplace('message_created', { messageId: data.id });

    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversationId);
  }

  async function decideOffer(offer: any, status: 'accepted' | 'rejected') {
    if (!offer) return;
    if (isCancelled) return;

    if (offer.status !== 'pending') {
      alert('This offer is no longer pending.');
      return;
    }

    if (offer.sender_id === currentUserId) {
      alert('You cannot respond to your own offer.');
      return;
    }

    if (offer.sender_role === currentUserRole) {
      alert('You cannot respond to an offer from your own role.');
      return;
    }

    if (isLocked) {
      alert('Negotiation is locked.');
      return;
    }

    if (
      status === 'accepted' &&
      !confirm(
        `Accept this offer for ${formatCurrency(
          Number(offer.amount),
        )}? The job becomes active only after homeowner payment.`,
      )
    ) {
      return;
    }

    setActionBusy(`${offer.id}:${status}`);

    if (status === 'accepted') {
      await acceptOffer(offer);
      return;
    }

    await declineOffer(offer);
  }

  async function acceptOffer(offer: any) {
    const { data, error: reserveError } = await supabase.rpc(
      'reserve_offer_for_payment',
      {
        p_offer_id: offer.id,
        p_payment_window_minutes: PAYMENT_WINDOW_MINUTES,
      },
    );

    if (reserveError) {
      setActionBusy(null);
      alert(reserveError.message);
      return;
    }

    const systemContent =
      currentUserRole === 'homeowner'
        ? `Offer accepted for ${formatCurrency(
            Number(offer.amount),
          )}. Complete payment within ${PAYMENT_WINDOW_MINUTES} minutes to book the contractor.`
        : `Budget offer accepted for ${formatCurrency(
            Number(offer.amount),
          )}. Waiting for homeowner payment.`;

    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      kind: 'system',
      offer_id: offer.id,
      content: systemContent,
    });

    if (messageError) {
      setActionBusy(null);
      alert(messageError.message);
      return;
    }

    await notifyMarketplace('offer_accepted', { offerId: offer.id });

    /**
     * Prefer accepted locally.
     * Project status should move to pending_payment through RPC.
     * router.refresh() will pull the real server state.
     */
    setOfferRows((rows) =>
      rows.map((row) =>
        row.id === offer.id
          ? {
              ...row,
              status: 'accepted',
              accepted_at: new Date().toISOString(),
              responded_at: new Date().toISOString(),
            }
          : row.status === 'pending'
            ? {
                ...row,
                status: 'countered',
                responded_at: new Date().toISOString(),
              }
            : row,
      ),
    );

    setActionBusy(null);

    if (currentUserRole === 'homeowner') {
      const reservedProjectId =
        data?.[0]?.project_id ?? data?.project_id ?? offer.project_id ?? projectId;

      if (reservedProjectId) {
        router.push(`/dashboard/checkout/project/${reservedProjectId}`);
        return;
      }
    }

    router.refresh();
  }

  async function declineOffer(offer: any) {
    const now = new Date().toISOString();

    /**
     * Long-term this should be moved into an RPC:
     * decline_offer(p_offer_id)
     */
    const { error } = await supabase
      .from('offers')
      .update({
        status: 'rejected',
        rejected_at: now,
        responded_at: now,
      })
      .eq('id', offer.id)
      .eq('status', 'pending');

    if (error) {
      setActionBusy(null);
      alert(error.message);
      return;
    }

    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      kind: 'system',
      offer_id: offer.id,
      content: 'Offer declined.',
    });

    if (messageError) {
      setActionBusy(null);
      alert(messageError.message);
      return;
    }

    await notifyMarketplace('offer_declined', { offerId: offer.id });

    await supabase
      .from('conversations')
      .update({
        last_message_at: now,
      })
      .eq('id', conversationId);

    setOfferRows((rows) =>
      rows.map((row) =>
        row.id === offer.id
          ? {
              ...row,
              status: 'rejected',
              rejected_at: now,
              responded_at: now,
            }
          : row,
      ),
    );

    setActionBusy(null);
    router.refresh();
  }

  function openCounter(offer: any) {
    if (!offer) return;

    setCounterFor(offer.id);
    setCounterAmount(String(Math.round(Number(offer.amount) * 0.95)));
    setCounterTimeline(offer.timeline_days ? String(offer.timeline_days) : '');
    setCounterScope('');
  }

  function closeCounter() {
    setCounterFor(null);
    setCounterAmount('');
    setCounterTimeline('');
    setCounterScope('');
  }

  async function submitCounter(parent: any) {
    if (!parent) return;

    if (isLocked || isCancelled) {
      alert('Negotiation is locked.');
      return;
    }

    if (parent.status !== 'pending') {
      alert('This offer is no longer pending.');
      return;
    }

    if (parent.sender_id === currentUserId) {
      alert('You cannot counter your own offer.');
      return;
    }

    if (parent.sender_role === currentUserRole) {
      alert('You cannot counter an offer from your own role.');
      return;
    }

    const amount = Number(counterAmount);
    const timelineDays = counterTimeline ? Number(counterTimeline) : null;

    if (!amount || amount <= 0) {
      alert('Enter a counter offer amount.');
      return;
    }

    if (timelineDays !== null && (!timelineDays || timelineDays <= 0)) {
      alert('Enter a valid timeline or leave it empty.');
      return;
    }

    const targetProjectId = parent.project_id ?? projectId;

    if (!targetProjectId) {
      alert('No project context.');
      return;
    }

    const now = new Date().toISOString();
    const cleanScope = counterScope.trim();
    const kind = 'counter_offer';

    setActionBusy(`${parent.id}:counter`);

    /**
     * Long-term this should be moved into an RPC:
     * create_counter_offer(p_parent_offer_id, p_amount, p_timeline_days, p_scope_summary)
     */

    /**
     * 1. Create fresh counter offer first.
     * The new offer must remain pending.
     */
    const { data: created, error: insertError } = await supabase
      .from('offers')
      .insert({
        project_id: targetProjectId,
        conversation_id: conversationId,
        parent_offer_id: parent.id,

        sender_id: currentUserId,
        sender_role: currentUserRole,

        recipient_id: parent.sender_id,
        recipient_role: parent.sender_role,

        kind,
        amount,
        timeline_days: timelineDays,

        scope_summary: cleanScope || parent.scope_summary || null,
        included_items: null,
        excluded_items: null,
        notes: cleanScope || null,

        message: JSON.stringify({
          type: kind,
          message: cleanScope || null,
          included: [],
          excluded: [],
          notes: cleanScope || null,
        }),

        status: 'pending',
      })
      .select('*')
      .single();

    if (insertError || !created) {
      setActionBusy(null);
      alert(insertError?.message ?? 'Could not send counter offer.');
      return;
    }

    /**
     * 2. Close older pending offers in same conversation.
     * Exclude the newly created counter offer.
     */
    const { error: closeOldPendingError } = await supabase
      .from('offers')
      .update({
        status: 'countered',
        responded_at: now,
      })
      .eq('conversation_id', conversationId)
      .eq('status', 'pending')
      .neq('id', created.id);

    if (closeOldPendingError) {
      setActionBusy(null);
      alert(closeOldPendingError.message);
      return;
    }

    /**
     * 3. Create visible structured offer card.
     */
    const messageContent =
      `Counter offer: ${formatCurrency(amount)}` +
      (timelineDays ? ` · ${timelineDays} days` : '') +
      (cleanScope ? `\nScope: ${cleanScope}` : '');

    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      kind: 'offer_card',
      offer_id: created.id,
      content: messageContent,
    });

    if (messageError) {
      setActionBusy(null);
      alert(messageError.message);
      return;
    }

    /**
     * 4. Update conversation timestamp.
     */
    const { error: conversationUpdateError } = await supabase
      .from('conversations')
      .update({
        last_message_at: now,
      })
      .eq('id', conversationId);

    if (conversationUpdateError) {
      setActionBusy(null);
      alert(conversationUpdateError.message);
      return;
    }

    /**
     * 5. Move project back into negotiation state.
     *
     * Do not touch legacy quote columns here.
     */
    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({
        status: 'negotiating',
        selected_offer_id: null,
        awarded_offer_id: null,
      })
      .eq('id', targetProjectId)
      .in('status', ['open', 'in_review', 'quoted', 'negotiating']);

    if (projectUpdateError) {
      setActionBusy(null);
      alert(projectUpdateError.message);
      return;
    }

    await notifyMarketplace('offer_created', { offerId: created.id });

    setOfferRows((rows) => [
      created,
      ...rows.map((row) =>
        row.conversation_id === conversationId &&
        row.status === 'pending' &&
        row.id !== created.id
          ? { ...row, status: 'countered', responded_at: now }
          : row,
      ),
    ]);

    setActionBusy(null);
    closeCounter();
    router.refresh();
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8fafc] px-4 py-4 sm:px-5">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <ConversationNotice
            isChatUnlocked={isChatUnlocked}
            hasExpiredDeal={hasExpiredDeal}
            isPendingPayment={isPendingPayment}
            isCancelled={isCancelled}
            currentUserRole={currentUserRole}
          />

          {visibleMessages.length === 0 && !activeDeal && (
            <EmptyThread isChatUnlocked={isChatUnlocked} />
          )}

          {visibleMessages.map((message) =>
            (message.kind ?? 'text') === 'offer_card' ? (
              <OfferMessage
                key={message.id}
                message={message}
                offer={offerRows.find((offer) => offer.id === message.offer_id)}
                mine={message.sender_id === currentUserId}
              />
            ) : (
              <ChatMessage
                key={message.id}
                message={message}
                mine={message.sender_id === currentUserId}
              />
            ),
          )}

          <div ref={endRef} />
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
        {activeDeal && (
          <CompactDealBar
            deal={activeDeal}
            currentUserRole={currentUserRole}
            currentUserId={currentUserId}
            isLocked={isLocked}
            isChatUnlocked={isChatUnlocked}
            isCancelled={isCancelled}
            actionBusy={actionBusy}
            counterFor={counterFor}
            counterAmount={counterAmount}
            counterTimeline={counterTimeline}
            counterScope={counterScope}
            setCounterAmount={setCounterAmount}
            setCounterTimeline={setCounterTimeline}
            setCounterScope={setCounterScope}
            onAcceptOffer={() => decideOffer(activeDeal.offer, 'accepted')}
            onDeclineOffer={() => decideOffer(activeDeal.offer, 'rejected')}
            onOpenCounter={() => openCounter(activeDeal.offer)}
            onCloseCounter={closeCounter}
            onSubmitCounter={() => submitCounter(activeDeal.offer)}
          />
        )}

        <form
          onSubmit={send}
          className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 transition ${
            isChatUnlocked
              ? 'border-slate-200 bg-white shadow-sm focus-within:border-slate-300 focus-within:ring-4 focus-within:ring-slate-100'
              : 'border-slate-200 bg-slate-50'
          }`}
        >
          <input
            className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed"
            placeholder={
              isChatUnlocked
                ? 'Write a message...'
                : 'Direct chat unlocks after the contractor commits'
            }
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={busy || !isChatUnlocked}
          />

          <button
            type="submit"
            disabled={busy || !text.trim() || !isChatUnlocked}
            aria-label="Send"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-950 text-white transition hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
          >
            <SendIcon />
          </button>
        </form>
      </footer>
    </div>
  );
}

async function notifyMarketplace(event: string, payload: Record<string, string>) {
  await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, ...payload }),
  }).catch(() => undefined);
}

function offerToDeal(offer: any, fallbackLabel: string) {
  const kind = String(offer.kind ?? '');

  const label =
    kind === 'budget_offer' || kind === 'homeowner_budget'
      ? 'Homeowner budget offer'
      : kind === 'contractor_offer' || kind === 'contractor_quote'
        ? 'Contractor offer'
        : kind === 'counter_offer' ||
            kind === 'homeowner_counter' ||
            kind === 'contractor_counter'
          ? 'Counter offer'
          : kind === 'quick_offer'
            ? 'Quick offer'
            : fallbackLabel;

  return {
    type: 'offer',
    status: offer.status,
    amount: Number(offer.amount ?? 0),
    timeline_days: offer.timeline_days ?? null,
    sender_role: offer.sender_role,
    offer,
    label,
  };
}

/* -------------------------------------------------------------------------- */
/* Notice                                                                      */
/* -------------------------------------------------------------------------- */

function ConversationNotice({
  isChatUnlocked,
  hasExpiredDeal,
  isPendingPayment,
  isCancelled,
  currentUserRole,
}: {
  isChatUnlocked: boolean;
  hasExpiredDeal: boolean;
  isPendingPayment: boolean;
  isCancelled: boolean;
  currentUserRole: 'homeowner' | 'contractor';
}) {
  if (isCancelled) {
    return (
      <InlineNotice tone="muted" title="This conversation is closed">
        This deal was cancelled. No further messages or offers are available.
      </InlineNotice>
    );
  }

  if (hasExpiredDeal) {
    return (
      <InlineNotice tone="danger" title="The previous offer expired">
        {currentUserRole === 'homeowner'
          ? 'Send a revised budget request or wait for the contractor to create a new offer.'
          : 'Create a new offer with clear scope, price, timeline, included work, and excluded work.'}
      </InlineNotice>
    );
  }

  if (isPendingPayment) {
    return (
      <InlineNotice tone="warning" title="Payment is required">
        {currentUserRole === 'homeowner'
          ? 'Complete checkout to book this contractor and unlock direct chat.'
          : 'Waiting for homeowner payment. Direct chat will open after checkout.'}
      </InlineNotice>
    );
  }

  if (!isChatUnlocked) {
    return (
      <InlineNotice tone="info" title="Direct chat is locked">
        Use structured offers only. Contact details, links and free messaging
        unlock once the deal is paid and the contractor commits to the job.
      </InlineNotice>
    );
  }

  return null;
}

function InlineNotice({
  tone,
  title,
  children,
}: {
  tone: 'info' | 'warning' | 'danger' | 'muted';
  title: string;
  children: React.ReactNode;
}) {
  const tones = {
    info: 'border-slate-200 bg-white text-slate-600',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-800',
    muted: 'border-slate-200 bg-slate-100 text-slate-600',
  } as const;

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm shadow-sm ${tones[tone]}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current opacity-60" />

        <div className="min-w-0">
          <div className="font-semibold text-slate-950">{title}</div>
          <div className="mt-0.5 text-sm leading-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                    */
/* -------------------------------------------------------------------------- */

function ChatMessage({ message, mine }: { message: any; mine: boolean }) {
  const isSystem = (message.kind ?? 'text') === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <div className="max-w-[82%] rounded-full border border-slate-200 bg-white px-3 py-1.5 text-center text-xs font-medium leading-5 text-slate-500 shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-end gap-2 ${
        mine ? 'justify-end' : 'justify-start'
      }`}
    >
      {!mine && <MiniAvatar label="F" />}

      <div
        className={`max-w-[72%] rounded-lg px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
          mine
            ? 'rounded-br-md bg-slate-950 text-white'
            : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] font-medium ${
            mine ? 'text-white/50' : 'text-slate-400'
          }`}
        >
          <span>{relativeTime(message.created_at)}</span>
          {mine && <span aria-hidden>✓</span>}
        </div>
      </div>

      {mine && <MiniAvatar label="B" brand />}
    </div>
  );
}

function OfferMessage({
  message,
  offer,
  mine,
}: {
  message: any;
  offer?: any | null;
  mine: boolean;
}) {
  const parsed = parseOfferCardMessage(message.content);

  const amount = offer?.amount ? Number(offer.amount) : parsed.amount;
  const timeline = offer?.timeline_days
    ? `${offer.timeline_days} days`
    : parsed.timeline;

  const scope =
    offer?.scope_summary ??
    offer?.notes ??
    parsed.scope ??
    extractMessagePreview(offer?.message);

  return (
    <div
      className={`flex items-end gap-2 ${
        mine ? 'justify-end' : 'justify-start'
      }`}
    >
      {!mine && <MiniAvatar label="F" />}

      <div className="w-full max-w-[420px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Offer update
              </div>

              <div className="mt-1 text-lg font-bold tracking-tight text-slate-950">
                {amount ? formatCurrency(amount) : 'Offer sent'}
              </div>

              {timeline && (
                <div className="mt-0.5 text-xs font-medium text-slate-500">
                  {timeline}
                </div>
              )}
            </div>

            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500">
              <DocumentIcon />
            </div>
          </div>

          {scope && (
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
              {scope}
            </p>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-right text-[11px] font-medium text-slate-400">
          {relativeTime(message.created_at)}
        </div>
      </div>

      {mine && <MiniAvatar label="B" brand />}
    </div>
  );
}

function EmptyThread({ isChatUnlocked }: { isChatUnlocked: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-slate-50 text-slate-400">
        <ChatIcon />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-950">
        {isChatUnlocked ? 'No messages yet' : 'Conversation not open yet'}
      </h3>

      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
        {isChatUnlocked
          ? 'Start the conversation when you are ready.'
          : 'Direct chat will become available after checkout is completed.'}
      </p>
    </div>
  );
}

function MiniAvatar({ label, brand = false }) {
  return (
    <div
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-xl text-[11px] font-bold shadow-sm ${
        brand
          ? 'bg-slate-950 text-white'
          : 'border border-slate-200 bg-white text-slate-600'
      }`}
    >
      {label}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Compact Deal Bar                                                            */
/* -------------------------------------------------------------------------- */

function CompactDealBar({
  deal,
  currentUserRole,
  currentUserId,
  isLocked,
  isChatUnlocked,
  isCancelled,
  actionBusy,
  counterFor,
  counterAmount,
  counterTimeline,
  counterScope,
  setCounterAmount,
  setCounterTimeline,
  setCounterScope,
  onAcceptOffer,
  onDeclineOffer,
  onOpenCounter,
  onCloseCounter,
  onSubmitCounter,
}) {
  const isPending = deal.status === 'pending';
  const isExpired = deal.status === 'expired';

  /**
   * Legacy offer statuses still supported visually.
   * Long-term, payment state should come from project/payment, not offer.
   */
  const isPaymentPending = deal.status === 'payment_pending';
  const isAccepted = deal.status === 'accepted';
  const isPaid = deal.status === 'paid';

  const sentByMe = deal.offer?.sender_id === currentUserId;

  const needsMyOfferResponse =
    isPending &&
    !isLocked &&
    !isCancelled &&
    deal.offer?.sender_id !== currentUserId &&
    deal.offer?.sender_role !== currentUserRole;

  const isCountering = counterFor === deal.offer?.id;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={deal.status} />

            <span className="text-sm font-semibold text-slate-950">
              {deal.label}
            </span>

            {!isChatUnlocked && !isExpired && (
              <span className="text-xs font-medium text-slate-400">
                Chat locked
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            {deal.amount > 0 && (
              <span className="text-xl font-bold tracking-tight text-slate-950">
                {formatCurrency(deal.amount)}
              </span>
            )}

            {deal.timeline_days && (
              <span className="text-sm font-medium text-slate-500">
                {deal.timeline_days} days
              </span>
            )}

            {isExpired && (
              <span className="text-sm font-medium text-red-600">
                New offer required
              </span>
            )}

            {isPaymentPending && currentUserRole === 'homeowner' && (
              <span className="text-sm font-medium text-amber-700">
                Complete checkout
              </span>
            )}

            {isPaymentPending && currentUserRole === 'contractor' && (
              <span className="text-sm font-medium text-slate-500">
                Waiting for payment
              </span>
            )}

            {!isLocked && isPending && sentByMe && (
              <span className="text-sm font-medium text-slate-500">
                Waiting for response
              </span>
            )}

            {isAccepted && (
              <span className="text-sm font-medium text-emerald-700">
                Accepted
              </span>
            )}

            {isPaid && (
              <span className="text-sm font-medium text-emerald-700">
                Payment confirmed
              </span>
            )}
          </div>
        </div>

        {!isCountering && (
          <div className="flex flex-wrap items-center gap-2">
            {needsMyOfferResponse && (
              <>
                <button
                  type="button"
                  disabled={Boolean(actionBusy) || isCancelled}
                  onClick={onDeclineOffer}
                  className={ghostActionBtn}
                >
                  Decline
                </button>

                <button
                  type="button"
                  disabled={Boolean(actionBusy) || isCancelled}
                  onClick={onOpenCounter}
                  className={ghostActionBtn}
                >
                  Counter
                </button>

                <button
                  type="button"
                  disabled={Boolean(actionBusy) || isCancelled}
                  onClick={onAcceptOffer}
                  className={primaryActionBtn}
                >
                  Accept
                </button>
              </>
            )}

            {isExpired && (
              <span className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                Ask for a new offer
              </span>
            )}

            {(isAccepted || isPaid) && (
              <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                Confirmed
              </span>
            )}
          </div>
        )}
      </div>

      {isCountering && (
        <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[120px_120px_1fr_auto]">
          <input
            type="number"
            min={1}
            value={counterAmount}
            onChange={(event) => setCounterAmount(event.target.value)}
            placeholder="Amount"
            className={compactInput}
          />

          <input
            type="number"
            min={1}
            value={counterTimeline}
            onChange={(event) => setCounterTimeline(event.target.value)}
            placeholder="Days"
            className={compactInput}
          />

          <input
            value={counterScope}
            onChange={(event) => setCounterScope(event.target.value)}
            placeholder="Short scope note..."
            className={compactInput}
          />

          <div className="flex gap-2">
            <button
              type="button"
              disabled={Boolean(actionBusy)}
              onClick={onCloseCounter}
              className={ghostActionBtn}
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={Boolean(actionBusy)}
              onClick={onSubmitCounter}
              className={primaryActionBtn}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes = {
    accepted: 'bg-emerald-50 text-emerald-700',
    paid: 'bg-emerald-50 text-emerald-700',
    payment_pending: 'bg-amber-50 text-amber-700',
    rejected: 'bg-slate-100 text-slate-500',
    expired: 'bg-red-50 text-red-700',
    countered: 'bg-slate-100 text-slate-600',
    pending: 'bg-amber-50 text-amber-700',
    cancelled: 'bg-slate-100 text-slate-500',
    withdrawn: 'bg-slate-100 text-slate-500',
  };

  const label =
    status === 'payment_pending'
      ? 'Payment required'
      : status === 'expired'
        ? 'Expired'
        : status.replaceAll('_', ' ');

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
        classes[status] ?? 'bg-slate-100 text-slate-600'
      }`}
    >
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function parseOfferCardMessage(content: string) {
  const amountMatch = content.match(/\$?\s*([\d,]+(?:\.\d+)?)/);

  const timelineMatch =
    content.match(/timeline:\s*([^\n.]+\.?)/i) ||
    content.match(/·\s*([0-9]+\s*days?)/i) ||
    content.match(/([0-9]+\s*days?)/i);

  const scopeMatch =
    content.match(/scope:\s*([\s\S]*?)$/i) ||
    content.match(/included:\s*([\s\S]*?)$/i);

  return {
    amount: amountMatch ? Number(amountMatch[1].replaceAll(',', '')) : null,
    timeline: timelineMatch ? timelineMatch[1].trim() : null,
    scope: scopeMatch ? scopeMatch[1].trim() : null,
  };
}

function extractMessagePreview(message?: string | null) {
  if (!message) return null;

  try {
    const parsed = JSON.parse(message);

    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }

    if (typeof parsed.notes === 'string' && parsed.notes.trim()) {
      return parsed.notes.trim();
    }

    return null;
  } catch {
    return message;
  }
}

const primaryActionBtn =
  'inline-flex h-9 items-center justify-center rounded-xl bg-slate-950 px-3.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

const ghostActionBtn =
  'inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

const compactInput =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-100';

/* -------------------------------------------------------------------------- */
/* Icons                                                                       */
/* -------------------------------------------------------------------------- */

function SendIcon() {
  return (
    <svg
      className="h-4 w-4 -translate-x-px"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M22 2 11 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M22 2 15 22 11 13 2 9 22 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      className="h-4.5 w-4.5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      <path
        d="M14 2v5h5M9 13h6M9 17h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.3-4.3A8 8 0 1 1 21 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
