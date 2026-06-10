'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'bidai_cookie_consent_v1';

/**
 * Lightweight cookie / tracking consent banner.
 *
 * bidAI only sets cookies that are strictly necessary for login and security
 * by default. The banner records the visitor's choice so analytics or other
 * non-essential tracking can check it before running.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      // localStorage unavailable (private mode etc.) — show the banner once.
      setVisible(true);
    }
  }, []);

  function record(choice: 'accepted' | 'necessary') {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice, at: new Date().toISOString() }),
      );
    } catch {
      // Ignore storage failures — the banner simply reappears next visit.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/10 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-600">
          bidAI uses cookies that are necessary to sign you in and keep the
          marketplace secure. With your consent we also use optional cookies to
          understand how the product is used. See our{' '}
          <Link
            href="/legal/privacy"
            className="font-bold text-[#f45112] hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => record('necessary')}
            className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
          >
            Necessary only
          </button>
          <button
            type="button"
            onClick={() => record('accepted')}
            className="h-9 rounded-lg bg-[#f45112] px-4 text-xs font-bold text-white transition hover:bg-[#d94406]"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
