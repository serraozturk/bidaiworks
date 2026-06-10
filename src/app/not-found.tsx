import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 text-6xl font-black text-slate-100">404</div>
      <h1 className="text-2xl font-black text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← Home
        </Link>
        <Link
          href="/dashboard"
          className="rounded-xl bg-[#f45112] px-4 py-2 text-sm font-black text-white hover:bg-[#d94406]"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
