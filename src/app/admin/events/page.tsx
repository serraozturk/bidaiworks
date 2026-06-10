import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPageHeader, Panel, Pill, EmptyRow, formatWhen } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const db = createAdminClient();

  const { data: events } = await db
    .from('marketplace_events')
    .select('id, event_type, summary, actor_role, project_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = events ?? [];

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Oversight"
        title="Audit log"
        description="A timestamped record of every offer, counter, acceptance, payment and status change — the negotiation paper trail for dispute resolution."
      />

      <Panel title="Marketplace events" description={`Showing the latest ${rows.length} event(s)`}>
        {rows.length === 0 ? (
          <EmptyRow>No events recorded yet.</EmptyRow>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5">
                  <Pill value={e.event_type.replace(/^(project|offer|payment)_/, '')} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-700">
                    {e.summary ?? e.event_type}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-400">
                    <span className="font-mono">{e.event_type}</span>
                    {e.actor_role ? ` · ${e.actor_role}` : ''} · {formatWhen(e.created_at)}
                  </p>
                </div>
                {e.project_id && (
                  <Link
                    href={`/admin/projects/${e.project_id}`}
                    className="shrink-0 text-xs font-black text-orange-600 hover:underline"
                  >
                    Project →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
