'use client';

import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Custom confirm dialog — replaces browser window.confirm() calls.
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <ConfirmDialog
 *     open={open}
 *     title="Delete this item?"
 *     message="This cannot be undone."
 *     tone="danger"
 *     onConfirm={() => { doAction(); setOpen(false); }}
 *     onCancel={() => setOpen(false)}
 *   />
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button when dialog opens (safer default)
  useEffect(() => {
    if (open) {
      setTimeout(() => cancelRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmBtnCls =
    tone === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-400'
      : tone === 'warning'
        ? 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-400'
        : 'bg-[#f45112] text-white hover:bg-[#d94406] focus:ring-orange-400';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="px-6 pt-6 pb-4">
          <h2
            id="confirm-title"
            className="text-base font-black text-slate-900"
          >
            {title}
          </h2>
          {message && (
            <p className="mt-1.5 text-sm leading-5 text-slate-500">{message}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex h-9 items-center rounded-xl px-4 text-sm font-black transition focus:outline-none focus:ring-2 ${confirmBtnCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook-based imperative confirm — drop-in replacement for window.confirm().
 *
 * Usage:
 *   const { confirm, ConfirmDialogNode } = useConfirm();
 *   // render: {ConfirmDialogNode}
 *   // call:   const ok = await confirm({ title: 'Delete?' });
 */
export function useConfirm() {
  // Implemented as a simple state machine; callers await a Promise.
  // Because hooks must be called at the top of a component, we expose a node
  // to render and an async confirm() function.
  const { useState, useCallback } = require('react') as typeof import('react');

  const [state, setState] = useState<{
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: Props['tone'];
    resolve: ((v: boolean) => void) | null;
  }>({ open: false, title: '', resolve: null });

  const confirm = useCallback(
    (opts: {
      title: string;
      message?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      tone?: Props['tone'];
    }) =>
      new Promise<boolean>((resolve) => {
        setState({ open: true, resolve, ...opts });
      }),
    [],
  );

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state]);

  const ConfirmDialogNode = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      tone={state.tone}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmDialogNode };
}
