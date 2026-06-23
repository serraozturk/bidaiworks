'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';

interface Props {
  projectId: string;
  contractorId: string | null;
  /** Render a compact inline button (for list views) instead of the full-size button */
  compact?: boolean;
}

/**
 * Homeowner-only completion action.
 *
 * Flow rule:
 * - Project can be completed only after payment.
 * - Direct chat is already unlocked at paid/in_progress.
 * - This button should not be shown before paid/in_progress, but we also guard here.
 */
export default function MarkCompleteButton({ projectId, contractorId, compact = false }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { confirm, ConfirmDialogNode } = useConfirm();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markComplete() {
    const ok = await confirm({
      title: 'Mark project as complete?',
      message: 'This will close the job and allow you to leave a review.',
      confirmLabel: 'Mark complete',
    });
    if (!ok) return;

    setBusy(true);
    setError(null);

    const { data: project, error: projectReadError } = await supabase
      .from('projects')
      .select('id, status, awarded_offer_id')
      .eq('id', projectId)
      .single();

    if (projectReadError || !project) {
      setError(projectReadError?.message ?? 'Project not found.');
      setBusy(false);
      return;
    }

    if (!['paid', 'in_progress'].includes(project.status)) {
      setError('This project can only be completed after checkout.');
      setBusy(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('projects')
      .update({
        status: 'completed',
        payment_status: 'released',
        completed_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .in('status', ['paid', 'in_progress']);
      const { error: paymentReleaseError } = await supabase
  .from('payments')
  .update({
    status: 'released',
    released_at: new Date().toISOString(),
  })
  .eq('project_id', projectId)
  .eq('status', 'held');

if (paymentReleaseError) {
  setError(paymentReleaseError.message);
  setBusy(false);
  return;
}

    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    if (project.awarded_offer_id) {
      await supabase
        .from('offers')
        .update({
          status: 'paid',
          responded_at: new Date().toISOString(),
        })
        .eq('id', project.awarded_offer_id);
    }

    if (contractorId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: convo } = await supabase
        .from('conversations')
        .select('id')
        .eq('project_id', projectId)
        .eq('contractor_id', contractorId)
        .maybeSingle();

      if (convo?.id && user?.id) {
        await supabase.from('messages').insert({
          conversation_id: convo.id,
          sender_id: user.id,
          kind: 'system',
          offer_id: project.awarded_offer_id ?? null,
          content:
            'Homeowner marked the project as completed. The job is now closed and review is available.',
        });
      }
    }

    await notifyMarketplace('project_completed', { projectId });

    setBusy(false);
    router.refresh();
  }

  if (compact) {
    return (
      <>
        {ConfirmDialogNode}
        <div className="relative">
          <button
            type="button"
            onClick={markComplete}
            disabled={busy}
            className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Completing…' : 'Complete'}
          </button>
          {error && (
            <span className="absolute left-0 top-full mt-1 text-[10px] font-bold text-red-600">
              {error}
            </span>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {ConfirmDialogNode}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={markComplete} disabled={busy}>
          {busy ? 'Completing...' : 'Mark project as complete'}
        </Button>

        {error && <span className="text-xs font-bold text-red-600">{error}</span>}
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
