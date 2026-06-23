import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPageHeader, Panel, StatCard, formatWhen } from '@/components/admin/ui';
import ContractorFilterTable from './ContractorFilterTable';

export const dynamic = 'force-dynamic';

export default async function AdminContractorsPage() {
  const db = createAdminClient();

  const [
    { data: companies },
    { data: profiles },
    { data: serviceAreas },
    { data: offers },
  ] = await Promise.all([
    db
      .from('contractor_profiles')
      .select(
        'user_id, company_name, verification_status, rating_avg, rating_count, completed_jobs_count, license_number, license_state, insurance_expires_at, created_at, city, state, phone',
      )
      .order('created_at', { ascending: false }),
    // Note: profiles has no `email` column - email lives in auth.users.
    db.from('profiles').select('id, full_name, role, created_at'),
    db.from('contractor_service_areas').select('contractor_id, zip_code'),
    db.from('offers').select('sender_id, sender_role'),

  ]);

  const rows = (companies ?? []) as any[];
  const allProfiles = (profiles ?? []) as any[];
  const profileById = new Map(allProfiles.map((p) => [p.id, p]));

  // Emails live in auth.users, not profiles. Fetch them in bulk for everyone
  // we need to display (existing contractor companies + incomplete signups).
  const completedIds = new Set(rows.map((c) => c.user_id));
  const incompleteSignups = allProfiles.filter(
    (p) => p.role === 'contractor' && !completedIds.has(p.id),
  );
  const idsNeedingEmail = [
    ...rows.map((c) => c.user_id),
    ...incompleteSignups.map((p) => p.id),
  ];
  const emailById = await fetchEmails(db, idsNeedingEmail);

  const zipCount = new Map<string, number>();
  for (const sa of serviceAreas ?? []) {
    zipCount.set(sa.contractor_id, (zipCount.get(sa.contractor_id) ?? 0) + 1);
  }

  const offerCount = new Map<string, number>();
  for (const o of offers ?? []) {
    if (o.sender_role === 'contractor') {
      offerCount.set(o.sender_id, (offerCount.get(o.sender_id) ?? 0) + 1);
    }
  }


  const verified = rows.filter((r) => r.verification_status === 'verified').length;
  const pending = rows.filter((r) => r.verification_status === 'pending_verification').length;
  const rejected = rows.filter((r) => r.verification_status === 'rejected').length;
  const suspended = rows.filter((r) => r.verification_status === 'suspended').length;

  const tableRows = rows.map((c) => {
    const owner = profileById.get(c.user_id) as any;
    return {
      user_id: c.user_id,
      company_name: c.company_name ?? '—',
      owner_name: owner?.full_name ?? '—',
      owner_email: emailById.get(c.user_id) ?? '',
      city: c.city ?? '',
      state: c.state ?? '',
      verification_status: c.verification_status ?? 'pending_verification',
      rating_avg: c.rating_avg,
      rating_count: c.rating_count ?? 0,
      completed_jobs_count: c.completed_jobs_count ?? 0,
      zip_count: zipCount.get(c.user_id) ?? 0,
      offer_count: offerCount.get(c.user_id) ?? 0,
      created_at: c.created_at,
      license_number: c.license_number ?? '—',
      license_state: c.license_state ?? '—',
      insurance_expires_at: c.insurance_expires_at,
    };
  });

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Oversight"
        title="Contractors"
        description="Every contractor registered on the marketplace."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total signups" value={rows.length + incompleteSignups.length} />
        <StatCard label="Verified" value={verified} tone="success" />
        <StatCard label="Pending review" value={pending} tone="warning" />
        <StatCard label="Rejected / Suspended" value={rejected + suspended} tone="danger" />
        <StatCard
          label="Incomplete onboarding"
          value={incompleteSignups.length}
          tone={incompleteSignups.length > 0 ? 'warning' : 'default'}
        />
      </div>

      {pending > 0 && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-sm font-bold text-amber-800">
            ⏳ <strong>{pending}</strong> contractor application{pending === 1 ? '' : 's'} waiting for verification
          </div>
          <span className="text-xs font-black text-amber-700">Use the "Pending" filter below ↓</span>
        </div>
      )}

      {incompleteSignups.length > 0 && (
        <div className="mb-5">
          <Panel
            title="Incomplete signups"
            description={`${incompleteSignups.length} signed up as a contractor but never finished onboarding - no company profile exists yet.`}
          >
            <ul className="divide-y divide-slate-100">
              {incompleteSignups.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{p.full_name ?? 'Unnamed'}</span>
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">
                        ONBOARDING NOT FINISHED
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {emailById.get(p.id) ?? 'no email on file'} · signed up {formatWhen(p.created_at)}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    Will appear here once they submit the contractor application form
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      <ContractorFilterTable rows={tableRows} />
    </div>
  );
}

async function fetchEmails(
  db: ReturnType<typeof createAdminClient>,
  userIds: string[],
): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();
  await Promise.all(
    userIds.map(async (id) => {
      try {
        const { data } = await db.auth.admin.getUserById(id);
        if (data.user?.email) emailMap.set(id, data.user.email);
      } catch {
        /* noop */
      }
    }),
  );
  return emailMap;
}
