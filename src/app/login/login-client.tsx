'use client';

import type React from 'react';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody } from '@/components/ui/Card';

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = sp.get('next') ?? '/dashboard';
  const confirm = sp.get('confirm');
  const signedOut = sp.get('signed_out');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError(null);

    const supabase = createClient();

    /**
     * Important:
     * Clear any stale session before signing in.
     * This prevents a previous user's session/cookies from interfering
     * with the next login redirect.
     */
    await supabase.auth.signOut();

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setLoading(false);
      setError(loginError.message);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      setError('Login succeeded, but user session could not be loaded.');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      setLoading(false);
      setError('Login succeeded, but profile could not be loaded.');
      return;
    }

    let target = next;

    /**
     * If the login page was opened with a specific next URL,
     * we respect it only after the user is authenticated.
     *
     * But for the generic /dashboard login flow, we route by DB role.
     */
    if (next === '/dashboard') {
      if (profile?.role === 'admin') {
        target = '/admin';
      } else if (profile?.role === 'contractor') {
        target = '/dashboard/contractor';
      } else if (profile?.role === 'homeowner') {
        target = '/dashboard/homeowner';
      } else {
        target = '/onboarding/homeowner';
      }
    }

    setLoading(false);

    /**
     * Refresh first, then replace.
     * replace avoids keeping the login page in browser history.
     */
    window.location.replace(target);
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-slate-50 px-4 py-12">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center">
        <section className="hidden lg:block">
          <div className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-black text-[#c94106]">
            Welcome back
          </div>

          <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight text-slate-900">
            Continue your renovation deal flow.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Manage projects, structured offers, checkout, active jobs and
            post-payment direct chat from your dashboard.
          </p>

          <div className="mt-6 grid max-w-xl gap-3">
            {[
              'Offer cards before checkout',
              'Direct chat only after payment',
              'Project completion and reviews after the job',
            ].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <Card className="rounded-xl shadow-lg shadow-slate-900/10">
          <CardBody className="space-y-5 p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#f45112]">
                Login
              </p>

              <h1 className="mt-1 text-2xl font-black text-slate-900">
                Welcome back
              </h1>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                Log in to continue managing your projects and offers.
              </p>
            </div>

            {confirm && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                Check your email for a confirmation link, then log in.
              </div>
            )}

            {signedOut && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                You have been signed out from all sessions.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                name="email"
                label="Email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <div className="space-y-1">
                <Input
                  type="password"
                  name="password"
                  label="Password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="text-right">
                  <Link
                    href="/forgot-password"
                    className="text-xs font-bold text-slate-500 hover:text-[#f45112] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Logging in…' : 'Log in'}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-600">
              Don&apos;t have an account?{' '}
              <Link
                href="/signup"
                className="font-black text-[#f45112] hover:underline"
              >
                Create account
              </Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}