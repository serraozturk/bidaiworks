import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPageHeader } from '@/components/admin/ui';
import EventsFilterList from './EventsFilterList';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const db = createAdminClient();

  const [{ data: events }, { data: projects }, { data: profiles }, { data: companies }] =
    await Promise.all([
      db
        .from('marketplace_events')
        .select('id, event_type, summary, actor_id, actor_role, project_id, created_at')
        .order('created_at', { ascending: false })
        .limit(300),
      db.from('projects').select('id, title'),
      db.from('profiles').select('id, full_name'),
      db.from('contractor_profiles').select('user_id, company_name'),
    ]);

  const rows = events ?? [];

  const projectById = new Map((projects ?? []).map((p) => [p.id, p.title]));
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const companyById = new Map((companies ?? []).map((c) => [c.user_id, c.company_name]));

  const tableRows = rows.map((e) => {
    const actorName = e.actor_id
      ? companyById.get(e.actor_id) ?? nameById.get(e.actor_id) ?? null
      : null;
    return {
      id: e.id,
      event_type: e.event_type,
      summary: e.summary ?? e.event_type,
      actor_role: e.actor_role ?? null,
      actor_id: e.actor_id ?? null,
      actor_name: actorName,
      project_id: e.project_id ?? null,
      project_title: e.project_id ? projectById.get(e.project_id) ?? null : null,
      created_at: e.created_at,
    };
  });

  // Distinct actors for the filter dropdown - only ones that actually
  // appear in the log, so the list stays relevant.
  const actorOptions = Array.from(
    new Map(
      tableRows
        .filter((r) => r.actor_id && r.actor_name)
        .map((r) => [r.actor_id as string, r.actor_name as string]),
    ),
  ).map(([id, name]) => ({ value: id, label: name }));

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Oversight"
        title="Audit log"
        description="A timestamped record of every offer, counter, acceptance, payment and status change — the negotiation paper trail for dispute resolution."
      />

      <EventsFilterList rows={tableRows} actorOptions={actorOptions} />
    </div>
  );
}
