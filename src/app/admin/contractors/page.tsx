import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminPageHeader, Panel, Pill, EmptyRow, StatCard } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

const STATUS_PILL: Record<string, string> = {
  verified: 'completed',
  pending_verification: 'in_review',
  rejected: 'cancelled',
  suspended: 'suspended',
};

const STATUS_LABEL: Record<string, string> = {
  verified: 'Verified',
  pending_verification: 'Pending',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

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
        'user_id, company_name, verified, verification_status, rating_avg, rating_count, completed_jobs_count, license_status, insurance_status, created_at, city, state, phone',
      )
      .order('created_at', { ascending: false }),
    db.from('profiles').select('id, full_name, email'),
    db.from('contractor_service_areas').select('contractor_id, zip_code'),
    db.from('offers').select('sender_id, sender_role'),
  ]);

  const rows = (companies ?? []) as any[];
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

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

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Oversight"
        title="Construction companies"
        description="Every contractor company registered on the marketplace."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Companies" value={rows.length} />
        <StatCard label="Verified" value={verified} tone="success" />
        <StatCard label="Pending review" value={pending} tone="warning" />
        <StatCard
          label="Avg rating"
          value={
            rows.length
              ? (rows.reduce((s, r) => s + Number(r.rating_avg ?? 0), 0) / rows.length).toFixed(1)
              : '—'
          }
        />
      </div>

      {pending > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          ⏳ {pending} contractor application{pending === 1 ? '' : 's'} waiting for verification.
        </div>
      )}

      <Panel title="All companies" description={`${rows.length} registered`}>
        {rows.length === 0 ? (
          <EmptyRow>No contractor companies yet.</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-black uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5">Company</th>
                  <th className="px-4 py-2.5">Owner</th>
                  <th className="px-4 py-2.5">Location</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Rating</th>
                  <th className="px-4 py-2.5">Jobs</th>
                  <th className="px-4 py-2.5">ZIPs</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => {
                  const owner = profileById.get(c.user_id) as any;
                  const status = c.verification_status ?? 'pending_verification';
                  const isPending = status === 'pending_verification';
                  return (
                    <tr key={c.user_id} className={isPending ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900">{c.company_name}</span>
                        {isPending && (
                          <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">NEW</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{owner?.full_name ?? '—'}</div>
                        <div className="text-xs text-slate-400">{owner?.email ?? ''}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.city && c.state ? `${c.city}, ${c.state}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Pill value={STATUS_PILL[status] ?? 'in_review'} />
                        <div className="mt-0.5 text-[10px] text-slate-400">{STATUS_LABEL[status] ?? status}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.rating_count > 0
                          ? `★ ${Number(c.rating_avg).toFixed(1)} (${c.rating_count})`
                          : 'New'}
                      </td>
                      <td className="px-4 py-3 font-black text-slate-700">{c.completed_jobs_count ?? 0}</td>
                      <td className="px-4 py-3 text-slate-600">{zipCount.get(c.user_id) ?? 0}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/contractors/${c.user_id}`}
                          className={`text-xs font-black hover:underline ${isPending ? 'text-amber-600' : 'text-orange-600'}`}
                        >
                          {isPending ? 'Review →' : 'Details →'}
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
