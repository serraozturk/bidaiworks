'use client';

import { useCallback, useEffect, useState } from 'react';

interface NoticeState {
  id: number;
  message: string;
  tone: 'error' | 'info' | 'success';
}

/**
 * Lightweight toast notification - replaces browser alert() calls, which
 * are jarring and block the page. Auto-dismisses after a few seconds, also
 * dismissible by click.
 *
 * Usage:
 *   const { notice, NoticeNode } = useNotice();
 *   // render: {NoticeNode}
 *   // call:   notice('Something went wrong.', 'error');
 */
export function useNotice() {
  const [items, setItems] = useState<NoticeState[]>([]);

  const notice = useCallback(
    (message: string, tone: NoticeState['tone'] = 'error') => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }, 5000);
    },
    [],
  );

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const NoticeNode = (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((item) => (
        <div
          key={item.id}
          role="alert"
          onClick={() => dismiss(item.id)}
          className={`pointer-events-auto w-full max-w-sm cursor-pointer rounded-xl border px-4 py-3 text-sm font-bold shadow-lg transition ${
            item.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : item.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );

  return { notice, NoticeNode };
}
