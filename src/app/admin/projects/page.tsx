import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AdminPageHeader, Panel, Pill, EmptyRow, StatCard, formatWhen,
} from '@/components/admin/ui';
import { approveProject, rejectProject } from '@/app/admin/actions';
import ProjectsFilterTable from './ProjectsFilterTable';

export const dynamic = 'force-dynamic';

export default async function AdminProjectsPage() {
  const db = createAdminClient();

  await db.rpc('expire_stale_deals').then(() => undefined, () => undefined);

  const [
    { data: projects, error: projectsError },
    { data: profiles },
    { data: categories },
    { data: acceptedOffers },
    { data: allOffers },
    { data: contractorProfiles },
    { data: { users: authUsers } },
  ] = await Promise.all([
    db.from('projects').select('id, title, status, payment_status, contractor_fee_status, moderation_status, moderation_note, homeowner_id, category_id, awarded_offer_id, created_at').order('created_at', { ascending: false }),
    db.from('profiles').select('id, full_name'),
    db.from('categories').select('id, name'),
    db.from('offers').select('id, project_id, sender_id, sender_role, recipient_id, recipient_role, amount, status').eq('status', 'accepted'),
    db.from('offers').select('project_id, id'),
    db.from('contractor_profiles').select('user_id, company_name'),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  if (projectsError) {
    console.error('Admin projects query error:', projectsError);
    throw new Error(projectsError.message);
  }

  const rows = projects ?? [];
  const emailById = new Map((authUsers ?? []).map((u: any) => [u.id, u.email as string]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const companyById = new Map((contractorProfiles ?? []).map((cp) => [cp.user_id, cp.company_name]));
  const acceptedOfferByProject = new Map((acceptedOffers ?? []).map((o) => [o.project_id, o]));
  const offerById = new Map((acceptedOffers ?? []).map((o) => [o.id, o]));

  const offerCount = new Map<string, number>();
  for (const o of allOffers ?? []) {
    offerCount.set(o.project_id, (offerCount.get(o.project_id) ?? 0) + 1);
  }

  // Exclude completed/cancelled from pending review — nothing actionable
  const pending = rows.filter(
    (p) =>
      (p.moderation_status ?? 'pending') === 'pending' &&
      !['completed', 'cancelled'].includes(String(p.status)),
  );
  const rejectedCount = rows.filter((p) => p.moderation_status === 'rejected').length;
  const activeCount = rows.filter((p) => ['open', 'in_review', 'quoted', 'negotiating'].includes(String(p.status))).length;
  const liveCount = rows.filter((p) => p.status === 'in_progress').length;
  const completedCount = rows.filter((p) => p.status === 'completed').length;

  function getHomeownerName(homeownerId: string): string {
    const p = profileById.get(homeownerId);
    return p?.full_name ?? emailById.get(homeownerId) ?? '—';
  }

  function getContractorName(project: typeof rows[0]): string | null {
    const awardedOffer = project.awarded_offer_id
      ? offerById.get(project.awarded_offer_id)
      : acceptedOfferByProject.get(project.id);
    if (!awardedOffer) return null;
    const contractorId =
      awardedOffer.sender_role === 'contractor'
        ? awardedOffer.sender_id
        : awardedOffer.recipient_role === 'contractor'
        ? awardedOffer.recipient_id
        : null;
    if (!contractorId) return null;
    return companyById.get(contractorId) ?? profileById.get(contractorId)?.full_name ?? emailById.get(contractorId) ?? null;
  }

  const tableRows = rows.map((project) => ({
    id: project.id,
    title: project.title,
    homeowner_name: getHomeownerName(project.homeowner_id),
    category_name: categoryById.get(project.category_id)?.name ?? 'Uncategorized',
    status: project.status ?? 'unknown',
    moderation_status: project.moderation_status ?? 'pending',
    payment_status: project.payment_status ?? 'unpaid',
    contractor_fee_status: project.contractor_fee_status ?? 'not_due',
    accepted_contractor: getContractorName(project),
    offer_count: offerCount.get(project.id) ?? 0,
    created_at: project.created_at,
    moderation_note: project.moderation_note ?? null,
  }));

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Oversight"
        title="All projects"
        description="Approve new requests before contractors can see them, then track each project through negotiation, payment and job lifecycle."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total projects" value={rows.length} />
        <StatCard label="Awaiting review" value={pending.length} tone="warning" />
        <StatCard label="Visible / active" value={activeCount} tone="brand" />
        <StatCard label="Active jobs" value={liveCount} tone="success" />
        <StatCard label="Completed" value={completedCount} tone="success" />
      </div>

      <div className="mb-5">
        <Panel
          title="Pending review"
          description={pending.length === 0 ? 'No projects waiting — all clear.' : `${pending.length} project${pending.length === 1 ? '' : 's'} hidden from contractors until approved.`}
        >
          {pending.length === 0 ? (
            <EmptyRow>Nothing waiting for review.</EmptyRow>
          ) : (
            <div className="divide-y divide-slate-100">
              {pending.map((project) => (
                <div key={project.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/projects/${project.id}`} className="truncate font-bold text-slate-900 hover:text-orange-600 hover:underline">
                        {project.title}
                      </Link>
                      <Pill value="pending review" />
                      <Pill value={project.status ?? 'draft'} />
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {getHomeownerName(project.homeowner_id)}{' '}
                      · {categoryById.get(project.category_id)?.name ?? 'Uncategorized'}{' '}
                      · submitted {formatWhen(project.created_at)}
                    </div>
                    {project.moderation_note && (
                      <p className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{project.moderation_note}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={approveProject}>
                      <input type="hidden" name="id" value={project.id} />
                      <button type="submit" className="h-9 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white transition hover:bg-emerald-700">
                        Approve & publish
                      </button>
                    </form>
                    <form action={rejectProject} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={project.id} />
                      <input name="note" placeholder="Reason" className="h-9 w-[190px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-orange-300" />
                      <button type="submit" className="h-9 rounded-xl bg-rose-600 px-4 text-xs font-black text-white transition hover:bg-rose-700">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <ProjectsFilterTable rows={tableRows} />

      {rejectedCount > 0 && (
        <div className="mt-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {rejectedCount} project{rejectedCount === 1 ? '' : 's'} rejected by admin moderation.
        </div>
      )}
    </div>
  );
}
