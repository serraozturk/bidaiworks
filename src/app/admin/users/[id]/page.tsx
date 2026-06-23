import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AdminPageHeader,
  Panel,
  Pill,
  EmptyRow,
  StatCard,
  BackLink,
  formatWhen,
  money,
} from '@/components/admin/ui';
import { AdminActionButton } from '@/components/admin/AdminActionButton';
import { setUserSuspended } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

export default async function AdminUserDetailPage({ params }: Params) {
  const db = createAdminClient();

  const { data: profile } = await db
    .from('profiles')
    .select('id, full_name, phone, role, created_at, suspended, suspended_at, suspension_reason')
    .eq('id', params.id)
    .maybeSingle();

  if (!profile || profile.role !== 'homeowner') notFound();

  const [
    { data: projects },
    { data: flags },
    { data: payments },
  ] = await Promise.all([
    db
      .from('projects')
      .select('id, title, status, moderation_status, created_at')
      .eq('homeowner_id', params.id)
      .order('created_at', { ascending: false }),
    db
      .from('admin_flags')
      .select('id, kind, severity, status, summary, created_at')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false }),
    db
      .from('payments')
      .select('id, project_id, total_amount, status, created_at')
      .eq('payer_id', params.id)
      .order('created_at', { ascending: false }),
  ]);

  let email = '—';
  try {
    const { data } = await db.auth.admin.getUserById(params.id);
    email = data.user?.email ?? '—';
  } catch {
    /* noop */
  }

  const suspended = Boolean((profile as any).suspended);
  const projectRows = projects ?? [];
  const flagRows = flags ?? [];
  const paymentRows = payments ?? [];
  const totalSpent = paymentRows
    .filter((p) => p.status === 'released')
    .reduce((s, p) => s + Number(p.total_amount ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <BackLink href="/admin/users" label="All homeowners" />

      <AdminPageHeader
        eyebrow="Homeowner"
        title={profile.full_name ?? 'Unknown user'}
        description={`${email} · Member since ${formatWhen(profile.created_at)}`}
      />

      {suspended && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          🚫 This account is currently suspended.{' '}
          {(profile as any).suspension_reason
            ? `Reason: ${(profile as any).suspension_reason}`
            : ''}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Projects" value={projectRows.length} />
        <StatCard label="Open flags" value={flagRows.filter((f) => f.status === 'open').length} tone={flagRows.filter((f) => f.status === 'open').length > 0 ? 'danger' : 'default'} />
        <StatCard label="Total spent" value={money(totalSpent)} tone="brand" />
        <StatCard label="Status" value={suspended ? 'Suspended' : 'Active'} tone={suspended ? 'danger' : 'success'} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <Panel title="Projects">
            {projectRows.length === 0 ? (
              <EmptyRow>No projects yet.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-100">
                {projectRows.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="text-sm font-bold text-slate-900">{p.title}</span>
                      <span className="ml-2 text-[11px] text-slate-400">{formatWhen(p.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill value={p.status ?? 'open'} />
                      <Pill value={p.moderation_status ?? 'pending'} />
                      <Link
                        href={`/admin/projects/${p.id}`}
                        className="text-xs font-black text-orange-600 hover:underline"
                      >
                        View →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Moderation flags">
            {flagRows.length === 0 ? (
              <EmptyRow>No flags on this account.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-100">
                {flagRows.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill value={f.kind.replaceAll('_', ' ')} />
                        <Pill value={f.status} />
                        <span className="text-sm font-semibold text-slate-700">{f.summary}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">{formatWhen(f.created_at)}</p>
                    </div>
                    {f.status === 'open' && (
                      <Link
                        href="/admin/flags"
                        className="text-xs font-black text-orange-600 hover:underline"
                      >
                        Open flags →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Account details">
            <ul className="divide-y divide-slate-100">
              <DetailRow label="Email" value={email} />
              <DetailRow label="Phone" value={(profile as any).phone ?? '—'} />
              <DetailRow label="Role" value="Homeowner" />
              <DetailRow label="Member since" value={formatWhen(profile.created_at)} />
              <DetailRow label="Account status" value={suspended ? 'Suspended' : 'Active'} />
            </ul>
          </Panel>

          <Panel title="Account actions">
            <div className="space-y-3 p-4">
              {suspended ? (
                <form action={setUserSuspended}>
                  <input type="hidden" name="id" value={params.id} />
                  <input type="hidden" name="suspended" value="false" />
                  <AdminActionButton tone="emerald" confirm="Restore this homeowner's account access?">
                    Restore account
                  </AdminActionButton>
                </form>
              ) : (
                <form action={setUserSuspended}>
                  <input type="hidden" name="id" value={params.id} />
                  <input type="hidden" name="suspended" value="true" />
                  <input
                    name="reason"
                    placeholder="Suspension reason..."
                    className="mb-2 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-100"
                  />
                  <AdminActionButton tone="rose" confirm="Suspend this homeowner's account? They won't be able to access the platform.">
                    Suspend account
                  </AdminActionButton>
                </form>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-sm font-bold text-slate-800">{value}</span>
    </li>
  );
}
