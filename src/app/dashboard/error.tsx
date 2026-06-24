'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-black text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-500">An unexpected error occurred on this page.</p>

      {error?.message && (
        <div className="mt-4 w-full max-w-lg rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-left">
          <p className="text-xs font-black uppercase tracking-wide text-red-500">Error details</p>
          <p className="mt-1 break-words font-mono text-sm text-red-700">{error.message}</p>
          {error.digest && (
            <p className="mt-1 text-xs font-semibold text-red-400">Digest: {error.digest}</p>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-black text-white hover:bg-orange-700"
        >
          Go to dashboard
        </a>
      </div>
    </main>
  );
}
