'use client';

import type React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody } from '@/components/ui/Card';

export default function UpdatePasswordClient() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setDone(false);
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setBusy(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setBusy(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    setPassword('');
    setConfirmPassword('');

    window.setTimeout(() => {
      router.push('/dashboard/settings?password_updated=1');
    }, 900);
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-md">
        <Card className="rounded-xl shadow-lg shadow-slate-900/10">
          <CardBody className="space-y-5 p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#f45112]">
                Account security
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-900">
                Choose a new password
              </h1>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Use a strong password that you do not use on other services.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="password"
                name="password"
                label="New password"
                autoComplete="new-password"
                minLength={8}
                required
                hint="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              <Input
                type="password"
                name="confirmPassword"
                label="Confirm new password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                  {error}
                </div>
              )}

              {done && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                  Password updated. Redirecting to settings...
                </div>
              )}

              <Button type="submit" disabled={busy || done} className="w-full">
                {busy ? 'Updating...' : 'Update password'}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-600">
              Back to{' '}
              <Link href="/login" className="font-black text-[#f45112] hover:underline">
                login
              </Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
