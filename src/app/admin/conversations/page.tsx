import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPageHeader, StatCard } from '@/components/admin/ui';
import ConversationsFilterTable from './ConversationsFilterTable';

export const dynamic = 'force-dynamic';

export default async function AdminConversationsPage() {
  const db = createAdminClient();

  const [
    { data: conversations },
    { data: messages },
    { data: profiles },
    { data: companies },
    { data: { users: authUsers } },
  ] = await Promise.all([
    db.from('conversations')
      .select('id, project_id, homeowner_id, contractor_id, last_message_at, created_at')
      .order('last_message_at', { ascending: false }),
    db.from('messages').select('conversation_id, kind'),
    db.from('profiles').select('id, full_name'),
    db.from('contractor_profiles').select('user_id, company_name'),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const rows = conversations ?? [];

  const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))];

  const { data: projects } = projectIds.length
    ? await db.from('projects').select('id, title, status').in('id', projectIds)
    : { data: [] as any[] };

  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const companyById = new Map((companies ?? []).map((c) => [c.user_id, c.company_name]));
  const emailById = new Map((authUsers ?? []).map((u: any) => [u.id, u.email as string]));

  function displayName(userId: string | null | undefined, preferCompany = false): string {
    if (!userId) return '—';
    if (preferCompany) {
      return companyById.get(userId) ?? profileById.get(userId) ?? emailById.get(userId) ?? userId.slice(0, 8);
    }
    return profileById.get(userId) ?? emailById.get(userId) ?? userId.slice(0, 8);
  }

  const msgCount = new Map<string, number>();
  for (const m of messages ?? []) {
    msgCount.set(m.conversation_id, (msgCount.get(m.conversation_id) ?? 0) + 1);
  }

  const totalMessages = (messages ?? []).length;
  const activeConvs = rows.filter((r) => {
    const project = projectById.get(r.project_id);
    return project && !['completed', 'cancelled'].includes(String(project.status));
  }).length;

  const tableRows = rows.map((c) => {
    const project = projectById.get(c.project_id);
    return {
      id: c.id,
      project_id: c.project_id,
      project_title: project?.title ?? 'Project',
      project_status: project?.status ?? null,
      homeowner_name: displayName(c.homeowner_id),
      contractor_name: displayName(c.contractor_id, true),
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

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Total conversations" value={rows.length} />
        <StatCard label="Active deal rooms" value={activeConvs} tone="brand" />
        <StatCard label="Total messages" value={totalMessages} />
      </div>

      <ConversationsFilterTable rows={tableRows} />
    </div>
  );
}
