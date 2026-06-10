'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center font-sans">
        <h1 className="text-2xl font-black text-slate-900">Something went wrong</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          A critical error occurred. Please refresh the page.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-xl bg-[#f45112] px-5 py-2.5 text-sm font-black text-white hover:bg-[#d94406]"
        >
          Refresh
        </button>
      </body>
    </html>
  );
}
