'use client';

import type React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody } from '@/components/ui/Card';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setSent(false);
    setError(null);

    const base = APP_URL || window.location.origin;
    const redirectTo = `${base}/auth/callback?next=/auth/update-password`;
    const supabase = createClient();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo },
    );

    setBusy(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-md">
        <Card className="rounded-xl shadow-lg shadow-slate-900/10">
          <CardBody className="space-y-5 p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#f45112]">
                Account recovery
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-900">
                Reset your password
              </h1>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Enter your account email. We will send a secure reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                name="email"
                label="Email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                  {error}
                </div>
              )}

              {sent && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                  Check your email for a password reset link.
                </div>
              )}

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-600">
              Remembered it?{' '}
              <Link href="/login" className="font-black text-[#f45112] hover:underline">
                Log in
              </Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
