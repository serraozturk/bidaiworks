'use client';

import type React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useConfirm } from '@/components/ui/ConfirmDialog';

export default function SecurityForm() {
  const router = useRouter();
  const { confirm, ConfirmDialogNode } = useConfirm();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState<'password' | 'sessions' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy('password');
    setMessage(null);
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setBusy(null);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setBusy(null);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setBusy(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setMessage('Password updated.');
  }

  async function signOutEverywhere() {
    const ok = await confirm({
      title: 'Sign out all sessions?',
      message: 'This will sign you out from this browser and all other active sessions.',
      confirmLabel: 'Sign out all',
      tone: 'warning',
    });
    if (!ok) return;

    setBusy('sessions');
    setMessage(null);
    setError(null);

    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });

    setBusy(null);

    if (signOutError) {
      setError(signOutError.message);
      return;
    }

    router.push('/login?signed_out=1');
    router.refresh();
  }

  return (
    <>
    {ConfirmDialogNode}
    <div className="space-y-5">
      <form onSubmit={updatePassword} className="space-y-4">
        <Input
          type="password"
          name="newPassword"
          label="New password"
          autoComplete="new-password"
          minLength={8}
          hint="At least 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Input
          type="password"
          name="confirmNewPassword"
          label="Confirm new password"
          autoComplete="new-password"
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
            {message}
          </div>
        )}

        <Button type="submit" disabled={busy !== null}>
          {busy === 'password' ? 'Updating...' : 'Update password'}
        </Button>
      </form>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-black text-slate-900">Session control</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Use this if you signed in on another device or think your account may
          be exposed.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          disabled={busy !== null}
          onClick={signOutEverywhere}
        >
          {busy === 'sessions' ? 'Signing out...' : 'Sign out all sessions'}
        </Button>
      </div>
    </div>
    </>
  );
}
