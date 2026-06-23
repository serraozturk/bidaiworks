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
import { setContractorVerified, setUserSuspended, rejectContractor } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

export default async function AdminContractorDetailPage({ params }: Params) {
  const db = createAdminClient();

  const { data: company } = await db
    .from('contractor_profiles')
    .select('*')
    .eq('user_id', params.id)
    .maybeSingle();

  if (!company) notFound();

  const [
    { data: owner },
    { data: catLinks },
    { data: areas },
    { data: offers },
    { data: payments },
    { data: reviews },
    { data: modHistory },
  ] = await Promise.all([
    db.from('profiles').select('id, full_name, phone, created_at, suspended, suspension_reason').eq('id', params.id).maybeSingle(),
    db.from('contractor_categories').select('category_id, categories(name)').eq('contractor_id', params.id),
    db.from('contractor_service_areas').select('zip_code, city, state').eq('contractor_id', params.id),
    db
      .from('offers')
      .select('id, project_id, amount, timeline_days, status, created_at')
      .eq('sender_id', params.id)
      .eq('sender_role', 'contractor')
      .order('created_at', { ascending: false }),
    db
      .from('payments')
      .select('id, project_id, project_amount, contractor_payout_amount, status, created_at')
      .eq('payee_id', params.id)
      .order('created_at', { ascending: false }),
    db
      .from('reviews')
      .select('id, rating, comment, created_at')
      .eq('contractor_id', params.id)
      .order('created_at', { ascending: false }),
    // Moderation history: all flags linked to this user (open + closed)
    db
      .from('admin_flags')
      .select('id, kind, severity, status, summary, admin_note, created_at, resolved_at')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false }),

  ]);

  let email = '—';
  try {
    const { data } = await db.auth.admin.getUserById(params.id);
    email = data.user?.email ?? '—';
  } catch {
    /* noop */
  }

  const offerRows = offers ?? [];
  const liveCompletedCount = (company as any).completed_jobs_count ?? 0;
  const suspended = Boolean((owner as any)?.suspended);
  const paymentRows = payments ?? [];
  const escrow = paymentRows
    .filter((p) => p.status === 'held')
    .reduce((s, p) => s + Number(p.contractor_payout_amount ?? p.project_amount ?? 0), 0);
  const earned = paymentRows
    .filter((p) => p.status === 'released')
    .reduce((s, p) => s + Number(p.contractor_payout_amount ?? p.project_amount ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-6">
      <div className="mb-4">
        <BackLink href="/admin/contractors" label="All companies" />
      </div>

      <AdminPageHeader
        eyebrow="Company"
        title={company.company_name}
        description={`Owner ${owner?.full_name ?? '—'} · ${email}`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Status"
          value={(company as any).verification_status === 'verified' ? 'Verified' : (company as any).verification_status === 'pending_verification' ? 'Pending' : (company as any).verification_status ?? 'Unknown'}
          tone={(company as any).verification_status === 'verified' ? 'success' : 'warning'}
        />
        <StatCard
          label="Rating"
          value={company.rating_count > 0 ? `★ ${Number(company.rating_avg).toFixed(1)}` : 'New'}
          hint={`${company.rating_count ?? 0} reviews`}
        />
        <StatCard label="Jobs completed" value={liveCompletedCount} />
        <StatCard label="Earned (released)" value={money(earned)} tone="success" hint={`${money(escrow)} in escrow`} />
      </div>

      {(company as any).verification_status === 'pending_verification' && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="text-sm font-black text-amber-800">⏳ Pending verification — review all details below, then approve or reject.</div>
          <p className="mt-1 text-xs text-amber-700">Check: license number, insurance expiry, business address, and that the company is US-based.</p>
        </div>
      )}
      {(company as any).verification_status === 'rejected' && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <div className="text-sm font-black text-red-800">✗ Application rejected</div>
          {(company as any).rejection_reason && (
            <p className="mt-1 text-xs text-red-700">Reason: {(company as any).rejection_reason}</p>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Panel title="Verification controls" description="Approve or reject this application.">
            <div className="space-y-3 px-4 py-4">
              {(company as any).verification_status !== 'verified' && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                  <div className="text-xs font-black uppercase tracking-wide text-emerald-700">Approve</div>
                  <p className="mt-1 text-sm leading-5 text-emerald-900/80">
                    Grants full dashboard access and makes this contractor visible on the platform.
                  </p>
                  <form action={setContractorVerified} className="mt-3">
                    <input type="hidden" name="id" value={params.id} />
                    <input type="hidden" name="verified" value="true" />
                    <AdminActionButton tone="emerald" confirm="Approve and verify this contractor?">
                      ✓ Approve contractor
                    </AdminActionButton>
                  </form>
                </div>
              )}

              {(company as any).verification_status === 'verified' && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">Revoke verification</div>
                  <form action={setContractorVerified} className="mt-3">
                    <input type="hidden" name="id" value={params.id} />
                    <input type="hidden" name="verified" value="false" />
                    <AdminActionButton tone="slate" confirm="Revoke verification and move back to pending?">
                      Revoke verification
                    </AdminActionButton>
                  </form>
                </div>
              )}

              {(company as any).verification_status !== 'rejected' && (
                <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-3">
                  <div className="text-xs font-black uppercase tracking-wide text-orange-700">Reject application</div>
                  <p className="mt-1 text-sm leading-5 text-orange-900/80">
                    Notifies the contractor their application was not approved.
                  </p>
                  <form action={rejectContractor} className="mt-3 space-y-2">
                    <input type="hidden" name="id" value={params.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <input
                      name="reason"
                      placeholder="Reason (required)"
                      required
                      className="h-9 w-full rounded-xl border border-orange-200 bg-white px-3 text-xs font-semibold outline-none focus:border-orange-400"
                    />
                    <AdminActionButton tone="rose" confirm="Reject this application?">
                      ✗ Reject application
                    </AdminActionButton>
                  </form>
                </div>
              )}

              <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-3">
                <div className="text-xs font-black uppercase tracking-wide text-rose-700">Account safety</div>
                <p className="mt-1 text-sm leading-5 text-rose-900/80">
                  Suspend for fraud, off-platform payments, or safety violations.
                </p>
                <form action={setUserSuspended} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={params.id} />
                  <input type="hidden" name="suspended" value={suspended ? 'false' : 'true'} />
                  {!suspended && (
                    <input
                      name="reason"
                      placeholder="Suspension reason"
                      className="h-9 min-w-0 flex-1 rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold outline-none focus:border-rose-400"
                    />
                  )}
                  <AdminActionButton
                    tone={suspended ? 'slate' : 'rose'}
                    confirm={suspended ? 'Restore this account?' : 'Suspend this account?'}
                  >
                    {suspended ? 'Restore account' : 'Suspend account'}
                  </AdminActionButton>
                </form>
              </div>
            </div>
          </Panel>

          <Panel title="Company profile">
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="Phone" value={(company as any).phone ?? owner?.phone ?? '—'} />
              <Row label="Address" value={(company as any).address_line ? `${(company as any).address_line}, ${(company as any).city ?? ''}, ${(company as any).state ?? ''} ${(company as any).zip_code ?? ''}`.trim() : '—'} />
              <Row label="License #" value={company.license_number ?? '—'} />
              <Row label="License state" value={(company as any).license_state ?? '—'} />
              <Row label="License status" value={company.license_status ?? 'none'} />
              <Row label="Insurance expiry" value={(company as any).insurance_expires_at ?? '—'} />
              <Row label="Insurance status" value={company.insurance_status ?? 'none'} />
              <Row label="Years in business" value={String(company.years_in_business ?? '—')} />
              <Row label="Company size" value={(company as any).employee_count ?? '—'} />
              <Row label="Website" value={company.website ?? '—'} />
              <Row label="Joined" value={formatWhen(company.created_at)} />
            </dl>
            {company.bio && (
              <p className="border-t border-slate-100 px-4 py-3 text-sm leading-6 text-slate-600">
                {company.bio}
              </p>
            )}
          </Panel>

          <Panel title="Categories & service areas">
            <div className="px-4 py-3">
              <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                Categories
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(catLinks ?? []).length === 0 ? (
                  <span className="text-xs text-slate-400">None set</span>
                ) : (
                  (catLinks ?? []).map((c: any, i: number) => (
                    <span
                      key={i}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"
                    >
                      {firstRow<any>(c.categories)?.name ?? 'Category'}
                    </span>
                  ))
                )}
              </div>
              <div className="mt-3 text-[11px] font-black uppercase tracking-wide text-slate-400">
                Service ZIPs ({(areas ?? []).length})
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(areas ?? []).length === 0 ? (
                  <span className="text-xs text-slate-400">None set</span>
                ) : (
                  (areas ?? []).map((a: any, i: number) => (
                    <span
                      key={i}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"
                    >
                      {a.zip_code}
                    </span>
                  ))
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Offers sent" description={`${offerRows.length} total`}>
            {offerRows.length === 0 ? (
              <EmptyRow>No offers sent.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-100">
                {offerRows.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <Link
                        href={`/admin/projects/${o.project_id}`}
                        className="text-sm font-black text-[#0b1220] hover:text-orange-600"
                      >
                        {money(o.amount)}
                      </Link>
                      <p className="text-[11px] font-semibold text-slate-400">
                        {o.timeline_days ? `${o.timeline_days} days · ` : ''}
                        {formatWhen(o.created_at)}
                      </p>
                    </div>
                    <Pill value={o.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Jobs & payments" description={`${paymentRows.length} payment record(s)`}>
            {paymentRows.length === 0 ? (
              <EmptyRow>No jobs yet.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-100">
                {paymentRows.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <Link
                        href={`/admin/projects/${p.project_id}`}
                        className="text-sm font-black text-[#0b1220] hover:text-orange-600"
                      >
                        {money(p.project_amount)}
                      </Link>
                      <p className="text-[11px] font-semibold text-slate-400">
                        Payout {money(p.contractor_payout_amount)} · {formatWhen(p.created_at)}
                      </p>
                    </div>
                    <Pill value={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Moderation history */}
          <Panel
            title="Moderation history"
            description={`${(modHistory ?? []).length} flag(s) on this account`}
          >
            {(modHistory ?? []).length === 0 ? (
              <EmptyRow>No flags on this account.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(modHistory ?? []).map((m: any) => (
                  <li key={m.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-[11px] font-black uppercase',
                          m.status === 'open'
                            ? 'bg-red-100 text-red-700'
                            : m.status === 'actioned'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600',
                        ].join(' ')}
                      >
                        {m.status}
                      </span>
                      <span className="text-sm font-bold text-slate-700">
                        {m.kind.replaceAll('_', ' ')} — {m.summary}
                      </span>
                    </div>
                    {m.admin_note && (
                      <p className="mt-1 text-xs text-slate-500">Admin note: {m.admin_note}</p>
                    )}
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                      {formatWhen(m.created_at)}
                      {m.resolved_at ? ` · resolved ${formatWhen(m.resolved_at)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Reviews" description={`${(reviews ?? []).length} review(s)`}>
            {(reviews ?? []).length === 0 ? (
              <EmptyRow>No reviews yet.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(reviews ?? []).map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <div className="text-sm font-black text-amber-600">★ {r.rating}/5</div>
                    {r.comment && (
                      <p className="mt-0.5 text-sm leading-6 text-slate-600">{r.comment}</p>
                    )}
                    <p className="text-[11px] font-semibold text-slate-400">
                      {formatWhen(r.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}
