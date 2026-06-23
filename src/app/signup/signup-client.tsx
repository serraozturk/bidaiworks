'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function SignupClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const queryRole =
    sp.get('role') === 'contractor' ? 'contractor' : 'homeowner';

  const [role, setRole] = useState<UserRole>(queryRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRole(queryRole);
  }, [queryRole]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError(null);

    if (!legalAccepted || !privacyAccepted) {
      setLoading(false);
      setError('Please accept the Terms and Privacy/KVKK/GDPR notice.');
      return;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      supabaseUrl.includes('YOUR-PROJECT') ||
      supabaseAnonKey === 'your-anon-key-here'
    ) {
      setLoading(false);
      setError('Supabase is not configured yet. Add .env.local to enable signup.');
      return;
    }

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          full_name: fullName,
          legal_terms_accepted: legalAccepted,
          privacy_notice_accepted: privacyAccepted,
          legal_accepted_at: new Date().toISOString(),
        },
       emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (!data.session) {
      router.push('/login?confirm=1');
      return;
    }

    router.push(
      role === 'contractor'
        ? '/onboarding/contractor'
        : '/onboarding/homeowner',
    );

    router.refresh();
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-white px-4 py-10 text-[#0f172a]">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center">
        <section className="hidden lg:block">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-black text-slate-700">
            Join bidAI
          </div>

          <h1 className="mt-5 max-w-2xl text-5xl font-black leading-tight tracking-tight text-slate-950">
            Create your account and manage renovation deals safely.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Compare structured offers, keep communication organized, and manage
            payments inside one protected marketplace.
          </p>

          <div className="mt-8 grid max-w-xl gap-3">
            {[
              'Structured offers with price, timeline and scope',
              'Protected checkout before direct communication',
              'Clear project flow for homeowners and contractors',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                  ✓
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            <InfoBox value="2 roles" label="Homeowner / Contractor" />
            <InfoBox value="Secure" label="Protected workflow" />
            <InfoBox value="Fast" label="Simple onboarding" />
          </div>
        </section>

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
          <CardBody className="space-y-6 p-7">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Create account
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Get started
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Choose your role and complete your profile after signup.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
              {(['homeowner', 'contractor'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    'rounded-xl px-3 py-3 text-sm font-black transition',
                    role === r
                      ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-500 hover:text-slate-900',
                  )}
                >
                  {r === 'homeowner' ? 'Homeowner' : 'Contractor'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                name="fullName"
                label={role === 'contractor' ? 'Your name' : 'Full name'}
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />

              <Input
                type="email"
                name="email"
                label="Email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Input
                type="password"
                name="password"
                label="Password"
                required
                autoComplete="new-password"
                minLength={8}
                hint="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={legalAccepted}
                    onChange={(e) => setLegalAccepted(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-slate-900"
                    required
                  />
                  <span className="text-xs font-semibold leading-5 text-slate-600">
                    I accept the{' '}
                    <Link
                      href="/legal/terms"
                      className="font-black text-slate-950 hover:underline"
                    >
                      Terms of Service
                    </Link>
                    , including marketplace payment, escrow, dispute and
                    off-platform contact rules.
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-slate-900"
                    required
                  />
                  <span className="text-xs font-semibold leading-5 text-slate-600">
                    I consent to processing my data under the{' '}
                    <Link
                      href="/legal/privacy"
                      className="font-black text-slate-950 hover:underline"
                    >
                      Privacy Policy and KVKK/GDPR Notice
                    </Link>
                    .
                  </span>
                </label>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
              >
                {loading ? 'Creating account…' : 'Create account'}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-600">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-black text-slate-950 hover:underline"
              >
                Log in
              </Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

function InfoBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-lg font-black text-slate-950">{value}</div>
      <div className="mt-1 text-xs font-semibold leading-4 text-slate-500">
        {label}
      </div>
    </div>
  );
}