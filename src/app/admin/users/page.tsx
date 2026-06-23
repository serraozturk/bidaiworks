import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AdminPageHeader,
  Panel,
  Pill,
  EmptyRow,
  StatCard,
  formatWhen,
} from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const db = createAdminClient();

  const [
    { data: homeowners },
    { data: projects },
    { data: flags },
  ] = await Promise.all([
    db
      .from('profiles')
      .select('id, full_name, phone, role, created_at, suspended, suspension_reason')
      .eq('role', 'homeowner')
      .order('created_at', { ascending: false })
      .limit(200),
    db
      .from('projects')
      .select('id, homeowner_id, status'),
    db
      .from('admin_flags')
      .select('id, user_id, status'),
  ]);

  const rows = homeowners ?? [];

  // Build lookup maps for project and flag counts
  const projectsByUser = new Map<string, number>();
  for (const p of projects ?? []) {
    projectsByUser.set(p.homeowner_id, (projectsByUser.get(p.homeowner_id) ?? 0) + 1);
  }

  const flagsByUser = new Map<string, number>();
  const openFlagsByUser = new Map<string, number>();
  for (const f of flags ?? []) {
    if (!f.user_id) continue;
    flagsByUser.set(f.user_id, (flagsByUser.get(f.user_id) ?? 0) + 1);
    if (f.status === 'open') {
      openFlagsByUser.set(f.user_id, (openFlagsByUser.get(f.user_id) ?? 0) + 1);
    }
  }

  const activeCount = rows.filter((r) => !r.suspended).length;
  const suspendedCount = rows.filter((r) => r.suspended).length;
  const flaggedCount = rows.filter((r) => (openFlagsByUser.get(r.id) ?? 0) > 0).length;

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Users"
        title="Homeowners"
        description="All registered homeowners — view their projects, moderation flags, and account status."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total" value={rows.length} />
        <StatCard label="Active" value={activeCount} tone="success" />
        <StatCard label="Suspended" value={suspendedCount} tone={suspendedCount > 0 ? 'danger' : 'default'} />
        <StatCard label="Open flags" value={flaggedCount} tone={flaggedCount > 0 ? 'warning' : 'default'} />
      </div>

      <Panel
        title="All homeowners"
        description={`${rows.length} registered`}
      >
        {rows.length === 0 ? (
          <EmptyRow>No homeowners yet.</EmptyRow>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((u) => {
              const projCount = projectsByUser.get(u.id) ?? 0;
              const openFlags = openFlagsByUser.get(u.id) ?? 0;
              const totalFlags = flagsByUser.get(u.id) ?? 0;

              return (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-slate-900">
                        {u.full_name ?? 'Unknown'}
                      </span>
                      {u.suspended && (
                        <Pill value="suspended" />
                      )}
                      {openFlags > 0 && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700">
                          ⚑ {openFlags} open flag{openFlags > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                      {projCount} project{projCount !== 1 ? 's' : ''}
                      {totalFlags > 0 ? ` · ${totalFlags} flag${totalFlags > 1 ? 's' : ''} total` : ''}
                      {' · '}joined {formatWhen(u.created_at)}
                    </p>
                    {u.suspended && u.suspension_reason && (
                      <p className="mt-0.5 text-[11px] font-semibold text-red-500">
                        Suspended: {u.suspension_reason}
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/admin/users/${u.id}`}
                    className="shrink-0 text-xs font-black text-orange-600 hover:underline"
                  >
                    View →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
