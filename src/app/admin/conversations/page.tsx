import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPageHeader, Panel, Pill, EmptyRow, formatWhen } from '@/components/admin/ui';

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

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Oversight"
        title="All conversations"
        description="Every homeowner ↔ contractor deal room on the marketplace. Open one to read the full thread."
      />

      <Panel title="Deal rooms" description={`${rows.length} conversation${rows.length === 1 ? '' : 's'}`}>
        {rows.length === 0 ? (
          <EmptyRow>No conversations yet.</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5">Project</th>
                  <th className="px-4 py-2.5">Homeowner</th>
                  <th className="px-4 py-2.5">Contractor</th>
                  <th className="px-4 py-2.5">Messages</th>
                  <th className="px-4 py-2.5">Last activity</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => {
                  const project = projectById.get(c.project_id);
                  const homeowner = profileById.get(c.homeowner_id);
                  const company = companyById.get(c.contractor_id);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {project?.title ?? 'Project'}
                          </span>
                          <Pill value={project?.status} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {homeowner?.full_name ?? 'Homeowner'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {company?.company_name ?? 'Contractor'}
                      </td>
                      <td className="px-4 py-3 font-black text-slate-700">
                        {msgCount.get(c.id) ?? 0}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatWhen(c.last_message_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/conversations/${c.id}`}
                          className="text-xs font-black text-orange-600 hover:underline"
                        >
                          Open thread →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
