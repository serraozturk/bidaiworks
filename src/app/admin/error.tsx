'use client';

import { useEffect } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin error:', error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 text-5xl">alert</div>
      <h1 className="text-2xl font-black text-slate-900">Admin page error</h1>

      <div className="mt-4 w-full max-w-xl rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-left">
        <p className="text-xs font-black uppercase tracking-wide text-red-500">Hata detayi</p>
        <p className="mt-2 break-words font-mono text-sm leading-6 text-red-800">
          {error?.message || 'Bilinmeyen hata'}
        </p>
        {error?.digest && (
          <p className="mt-2 text-xs font-semibold text-red-400">Digest: {error.digest}</p>
        )}
        {error?.stack && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-black text-red-500">Stack trace</summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all text-xs leading-5 text-red-700">
              {error.stack}
            </pre>
          </details>
        )}
      </div>

      <p className="mt-4 text-sm text-slate-500">
        Bu hatay not alip gelistiriciyle paylasin.
      </p>

      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Tekrar dene
        </button>
        <a
          href="/admin"
          className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-black text-white hover:bg-orange-700"
        >
          Admin ana sayfa
        </a>
      </div>
    </main>
  );
}
