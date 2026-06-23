'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

type Busy = 'resend' | 'check' | 'signout' | null;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

export default function VerifyEmailClient({ email }: { email: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [busy, setBusy] = useState<Busy>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stillUnverified, setStillUnverified] = useState(false);

  async function resend() {
    setBusy('resend');
    setError(null);
    setSent(false);

    const base = APP_URL || window.location.origin;
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${base}/auth/callback?next=/dashboard`,
      },
    });

    setBusy(null);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setSent(true);
  }

  async function checkVerified() {
    setBusy('check');
    setError(null);
    setStillUnverified(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setBusy(null);

    if (user?.email_confirmed_at) {
      router.replace('/dashboard');
      router.refresh();
      return;
    }

    setStillUnverified(true);
  }

  async function signOut() {
    setBusy('signout');
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-md">
        <Card className="rounded-xl shadow-lg shadow-slate-900/10">
          <CardBody className="space-y-5 p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#f45112]">
                One last step
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-900">
                Confirm your email
              </h1>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                We sent a confirmation link to{' '}
                <span className="font-bold text-slate-900">
                  {email || 'your email address'}
                </span>
                . Open it to verify your account, then come back and continue.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
              Verifying your email keeps the marketplace safe for homeowners and
              contractors. You can browse and act on bidAI as soon as your email
              is confirmed.
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                {error}
              </div>
            )}

            {sent && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                A new confirmation link is on its way. Check your inbox and spam
                folder.
              </div>
            )}

            {stillUnverified && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                Your email still looks unconfirmed. Open the link in the email,
                then try again.
              </div>
            )}

            <div className="space-y-2">
              <Button
                type="button"
                onClick={checkVerified}
                disabled={Boolean(busy)}
                className="w-full"
              >
                {busy === 'check' ? 'Checking...' : "I've confirmed — continue"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={resend}
                disabled={Boolean(busy)}
                className="w-full"
              >
                {busy === 'resend' ? 'Sending...' : 'Resend confirmation email'}
              </Button>
            </div>

            <button
              type="button"
              onClick={signOut}
              disabled={Boolean(busy)}
              className="w-full text-center text-sm font-bold text-slate-500 hover:text-slate-900"
            >
              {busy === 'signout' ? 'Signing out...' : 'Sign out'}
            </button>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
