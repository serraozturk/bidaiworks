import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface Params {
  params: { homeownerId: string };
  searchParams: { from?: string };
}

export default async function HomeownerProfileForContractorPage({ params, searchParams }: Params) {
  const supabase = createClient();
  const db = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Access control: contractor must have an active conversation with this homeowner
  const { data: conversation } = await supabase
    .from('conversations')
    .select('project_id, projects(status, title, category_id, categories(name))')
    .eq('contractor_id', user.id)
    .eq('homeowner_id', params.homeownerId)
    .maybeSingle();

  const projectStatus = (conversation as any)?.projects?.status ?? null;
  const hasAccess =
    conversation !== null &&
    ['in_progress', 'completed', 'paid', 'negotiating', 'pending_payment'].includes(
      projectStatus ?? '',
    );

  if (!hasAccess) {
    redirect('/dashboard/contractor');
  }

  const [
    { data: profile },
    { data: projectHistory },
  ] = await Promise.all([
    db
      .from('profiles')
      .select('id, full_name, created_at')
      .eq('id', params.homeownerId)
      .eq('role', 'homeowner')
      .maybeSingle(),
    db
      .from('projects')
      .select('id, title, status, moderation_status, created_at, categories(name)')
      .eq('homeowner_id', params.homeownerId)
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  if (!profile) notFound();

  const backHref = searchParams.from ?? '/dashboard/contractor';
  const projectRows = projectHistory ?? [];
  const completedCount = projectRows.filter((p) => p.status === 'completed').length;
  const activeCount = projectRows.filter((p) =>
    ['in_progress', 'paid', 'negotiating'].includes(p.status),
  ).length;

  // Mask full name: show first name + last initial only
  const displayName = maskName(profile.full_name ?? 'Homeowner');
  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <Link href={backHref} className="text-xs font-bold text-slate-500 hover:text-orange-600">
            ← Back
          </Link>
          <span className="text-xs font-semibold text-slate-400">Homeowner profile</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 space-y-5">

        {/* Hero */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-3xl font-black text-white shadow-md">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-2xl font-black text-slate-900">{displayName}</h1>
          <p className="mt-1 text-sm text-slate-400">Member since {memberSince}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Projects" value={String(projectRows.length)} />
          <StatCard label="Completed" value={String(completedCount)} />
          <StatCard label="Active" value={String(activeCount)} />
        </div>

        {/* Project history */}
        {projectRows.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-black text-slate-900">Project history</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {projectRows.map((p: any) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{p.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {p.categories?.name ?? 'Renovation'} ·{' '}
                      {new Date(p.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <StatusPill value={p.status} />
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
}

/** Show "John D." instead of "John Doe" for privacy */
function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
      <div className="text-xl font-black text-slate-900">{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  in_progress: 'bg-blue-100 text-blue-700',
  paid: 'bg-violet-100 text-violet-700',
  negotiating: 'bg-amber-100 text-amber-700',
  open: 'bg-slate-100 text-slate-600',
};

function StatusPill({ value }: { value: string }) {
  const cls = STATUS_STYLES[value] ?? 'bg-slate-100 text-slate-500';
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>
      {value.replace('_', ' ')}
    </span>
  );
}
