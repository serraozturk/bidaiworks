'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LandingSearchProps {
  categories: { slug: string; name: string }[];
  isAuthed: boolean;
}

/**
 * Hero search on the landing page. Lets the visitor pick a category and a
 * ZIP / city. Submits to the homeowner "new project" page with prefill query
 * params. If the user is not signed in, the auth middleware will detour them
 * through /login first and bring them back to the same URL afterwards.
 */
export function LandingSearch({ categories, isAuthed }: LandingSearchProps) {
  const router = useRouter();
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? '');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildTarget() {
    const trimmed = location.trim();
    const params = new URLSearchParams();
    if (categorySlug) params.set('category', categorySlug);
    if (trimmed) {
      const isZip = /^\d{5}$/.test(trimmed);
      params.set(isZip ? 'zip' : 'city', trimmed);
    }
    const qs = params.toString();
    return `/dashboard/homeowner/new${qs ? `?${qs}` : ''}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!location.trim()) {
      setError('Add a ZIP or city to find local contractors.');
      return;
    }

    setBusy(true);
    const target = buildTarget();
    if (isAuthed) {
      router.push(target);
    } else {
      router.push(`/login?next=${encodeURIComponent(target)}`);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
    >
      <div className="grid gap-3 md:grid-cols-[1.2fr_0.9fr_auto]">
        <label className="rounded-xl border border-slate-200 px-4 py-3">
          <span className="block text-xs font-bold text-ink-500">What do you need?</span>
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="mt-1 block w-full bg-transparent text-sm font-black text-ink-900 focus:outline-none"
            aria-label="Project category"
          >
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="rounded-xl border border-slate-200 px-4 py-3">
          <span className="block text-xs font-bold text-ink-500">Where?</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="ZIP or city"
            inputMode="text"
            className="mt-1 block w-full bg-transparent text-sm font-black text-ink-900 placeholder:font-bold placeholder:text-ink-400 focus:outline-none"
            aria-label="ZIP code or city"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="grid place-items-center rounded-xl bg-brand-600 px-6 py-3 text-sm font-black text-white transition hover:bg-brand-700 disabled:bg-brand-300"
        >
          {busy ? 'Loading...' : 'Get quotes'}
        </button>
      </div>

      {error && (
        <p className="mt-2 px-1 text-xs font-bold text-red-600">{error}</p>
      )}

      {!isAuthed && (
        <p className="mt-2 px-1 text-xs text-ink-500">
          You will sign in or create a free account before posting your project.
        </p>
      )}
    </form>
  );
}
