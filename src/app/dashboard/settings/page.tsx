import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Profile } from '@/lib/types';
import SettingsForm from './settings-form';
import SecurityForm from './security-form';

interface Params {
  searchParams?: { password_updated?: string };
}

export default async function SettingsPage({ searchParams }: Params) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) redirect('/onboarding/homeowner');

  const isContractor = profile.role === 'contractor';

  const [{ data: workspaceRows }, { data: conversations }] = await Promise.all([
   isContractor
  ? supabase
      .from('offers')
      .select('id, status, sender_id, recipient_id, sender_role, recipient_role')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      : supabase
          .from('projects')
          .select('id, status')
          .eq('homeowner_id', user.id),

    isContractor
      ? supabase
          .from('conversations')
          .select('id')
          .eq('contractor_id', user.id)
      : supabase
          .from('conversations')
          .select('id')
          .eq('homeowner_id', user.id),
  ]);

  const { data: contractor } = isContractor
    ? await supabase
        .from('contractor_profiles')
        .select('company_name, verified, rating_avg, rating_count, website')
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };

  const activeCount = (workspaceRows ?? []).filter(
    (item: any) =>
      ![
        'completed',
        'cancelled',
        'rejected',
        'withdrawn',
        'expired',
      ].includes(item.status),
  ).length;

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <Link
            href={isContractor ? '/dashboard/contractor' : '/dashboard/homeowner'}
            className="mb-4 inline-flex items-center gap-1 text-sm font-black text-slate-500 hover:text-[#f45112]"
          >
            ← Back to dashboard
          </Link>

          <p className="text-sm font-black uppercase tracking-wide text-[#f45112]">
            {isContractor ? 'Contractor account' : 'Homeowner account'}
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight">
            Settings
          </h1>

          <p className="mt-1 text-sm leading-6 text-slate-600">
            Manage your personal profile, contact details, and workspace
            preferences.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Card>
              <CardBody>
                <h2 className="mb-4 text-lg font-black">Personal details</h2>
                <SettingsForm profile={profile as Profile} />
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="mb-4 text-lg font-black">Security</h2>

                {searchParams?.password_updated === '1' && (
                  <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                    Password updated.
                  </div>
                )}

                <SecurityForm />
              </CardBody>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardBody>
                <h2 className="font-black">Workspace summary</h2>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs font-bold text-slate-500">
                      {isContractor ? 'Active offers' : 'Active projects'}
                    </div>

                    <div className="mt-1 text-2xl font-black">
                      {activeCount}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs font-bold text-slate-500">
                      Deal rooms
                    </div>

                    <div className="mt-1 text-2xl font-black">
                      {conversations?.length ?? 0}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/dashboard"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold hover:bg-slate-50"
                  >
                    Dashboard
                  </Link>

                  <Link
                    href="/dashboard/messages"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold hover:bg-slate-50"
                  >
                    Deal rooms
                  </Link>
                </div>
              </CardBody>
            </Card>

            {isContractor && contractor && (
              <Card>
                <CardBody>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black">
                      {contractor.company_name || 'Contractor profile'}
                    </h2>

                    {contractor.verified && (
                      <Badge tone="success">Verified</Badge>
                    )}
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {contractor.rating_count > 0
                      ? `${Number(contractor.rating_avg ?? 0).toFixed(
                          1,
                        )} rating from ${contractor.rating_count} reviews`
                      : 'Reviews and verification details appear here after completed jobs.'}
                  </p>

                  {contractor.website && (
                    <Link
                      href={contractor.website}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-sm font-bold text-[#f45112] hover:underline"
                    >
                      Visit website
                    </Link>
                  )}

                  <div className="mt-4">
                    <Link
                      href="/dashboard/contractor/profile"
                      className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold hover:bg-slate-50"
                    >
                      Edit contractor profile
                    </Link>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  );
} 