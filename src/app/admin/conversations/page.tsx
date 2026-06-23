import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPageHeader } from '@/components/admin/ui';
import ConversationsFilterTable from './ConversationsFilterTable';

export const dynamic = 'force-dynamic';

export default async function AdminConversationsPage() {
  const db = createAdminClient();

  const [{ data: conversations }, { data: messages }] = await Promise.all([
    db
      .from('conversations')
      .select('id, project_id, homeowner_id, contractor_id, last_message_at, created_at')
      .order('last_message_at', { ascending: false }),
    db.from('messages').select('conversation_id, kind'),
  ]);

  const rows = conversations ?? [];

  const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))];
  const homeownerIds = [...new Set(rows.map((r) => r.homeowner_id).filter(Boolean))];
  const contractorIds = [...new Set(rows.map((r) => r.contractor_id).filter(Boolean))];

  const [{ data: projects }, { data: profiles }, { data: companies }] = await Promise.all([
    projectIds.length
      ? db.from('projects').select('id, title, status').in('id', projectIds)
      : Promise.resolve({ data: [] as any[] }),
    homeownerIds.length
      ? db.from('profiles').select('id, full_name').in('id', homeownerIds)
      : Promise.resolve({ data: [] as any[] }),
    contractorIds.length
      ? db.from('contractor_profiles').select('user_id, company_name').in('user_id', contractorIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const companyById = new Map((companies ?? []).map((c) => [c.user_id, c]));

  const msgCount = new Map<string, number>();
  for (const m of messages ?? []) {
    msgCount.set(m.conversation_id, (msgCount.get(m.conversation_id) ?? 0) + 1);
  }

  const tableRows = rows.map((c) => {
    const project = projectById.get(c.project_id);
    const homeowner = profileById.get(c.homeowner_id);
    const company = companyById.get(c.contractor_id);
    return {
      id: c.id,
      project_title: project?.title ?? 'Project',
      project_status: project?.status ?? null,
      homeowner_name: homeowner?.full_name ?? 'Homeowner',
      contractor_name: company?.company_name ?? 'Contractor',
      message_count: msgCount.get(c.id) ?? 0,
      last_message_at: c.last_message_at,
    };
  });

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Oversight"
        title="All conversations"
        description="Every homeowner ↔ contractor deal room on the marketplace. Open one to read the full thread."
      />

      <ConversationsFilterTable rows={tableRows} />
    </div>
  );
}
