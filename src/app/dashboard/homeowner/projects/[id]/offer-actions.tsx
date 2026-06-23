'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface Props {
  offerId: string;
  projectId: string;
  status: string;
  isAwarded: boolean;
  projectStatus: string;
  senderRole: 'homeowner' | 'contractor';
}

const PAYMENT_WINDOW_MINUTES = 60;

const LOCKED_PROJECT_STATUSES = [
  'pending_payment',
  'awarded',
  'paid',
  'in_progress',
  'completed',
  'cancelled',
];

const ACTIONABLE_OFFER_STATUSES = ['pending', 'countered'];

export default function OfferActions({
  offerId,
  projectId,
  status,
  isAwarded,
  projectStatus,
  senderRole,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { confirm, ConfirmDialogNode } = useConfirm();

  const [busyAction, setBusyAction] = useState<'accept' | 'decline' | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);

  const isLocked = LOCKED_PROJECT_STATUSES.includes(projectStatus);
  const isContractorOffer = senderRole === 'contractor';
  const isActionable = ACTIONABLE_OFFER_STATUSES.includes(status);

  const canAccept = isContractorOffer && isActionable && !isLocked;
  const canDecline = isContractorOffer && isActionable && !isLocked;

  async function accept() {
    const confirmed = await confirm({
      title: 'Accept this offer?',
      message: 'The contractor is not booked until payment is completed.',
      confirmLabel: 'Accept & checkout',
    });

    if (!confirmed) return;

    setBusyAction('accept');
    setError(null);

    const { error: rpcError } = await supabase.rpc('reserve_offer_for_payment', {
      p_offer_id: offerId,
      p_payment_window_minutes: PAYMENT_WINDOW_MINUTES,
    });

    if (rpcError) {
      setError(rpcError.message);
      setBusyAction(null);
      return;
    }

    await notifyMarketplace('offer_accepted', { offerId });

    // Navigate straight to checkout. Do not call router.refresh() here -
    // refreshing the current route while a push is in flight can leave the
    // browser stuck on the old page instead of opening checkout.
    router.push(`/dashboard/checkout/project/${projectId}`);
  }

  async function decline() {
    const confirmed = await confirm({
      title: 'Decline this offer?',
      tone: 'danger',
      confirmLabel: 'Decline',
    });

    if (!confirmed) return;

    setBusyAction('decline');
    setError(null);

    const { error: declineError } = await supabase
      .from('offers')
      .update({
        status: 'rejected',
        responded_at: new Date().toISOString(),
      })
      .eq('id', offerId)
      .eq('project_id', projectId)
      .in('status', ACTIONABLE_OFFER_STATUSES);

    if (declineError) {
      setError(declineError.message);
      setBusyAction(null);
      return;
    }

    await notifyMarketplace('offer_declined', { offerId });

    setBusyAction(null);
    router.refresh();
  }

  if (
    (projectStatus === 'pending_payment' || projectStatus === 'awarded') &&
    isAwarded
  ) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800">
          Payment is required before this contractor is booked.
        </div>

        <Button
          size="sm"
          onClick={() => router.push(`/dashboard/checkout/project/${projectId}`)}
          disabled={Boolean(busyAction)}
        >
          Continue checkout
        </Button>
      </div>
    );
  }

  if (isLocked) {
    return isAwarded ? (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
        ✓ Selected
      </div>
    ) : null;
  }

  if (status === 'accepted') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
        Accepted
      </div>
    );
  }

  if (['rejected', 'expired', 'withdrawn'].includes(status)) {
    return null;
  }

  if (!isContractorOffer) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
        Waiting for contractor response
      </div>
    );
  }

  return (
    <>
      {ConfirmDialogNode}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={decline}
            disabled={Boolean(busyAction) || !canDecline}
          >
            {busyAction === 'decline' ? 'Declining...' : 'Decline'}
          </Button>

          <Button
            size="sm"
            onClick={accept}
            disabled={Boolean(busyAction) || !canAccept}
          >
            {busyAction === 'accept' ? 'Processing...' : 'Accept'}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {error}
          </div>
        )}
      </div>
    </>
  );
}

async function notifyMarketplace(event: string, payload: Record<string, string>) {
  await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, ...payload }),
  }).catch(() => undefined);
}
