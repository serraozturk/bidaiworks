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
import {
  approveProject,
  refundProjectEscrow,
  rejectProject,
  releaseProjectEscrow,
} from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

export default async function AdminProjectDetailPage({ params }: Params) {
  const db = createAdminClient();

  const { data: project } = await db
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!project) notFound();

  const [
    { data: homeowner },
    { data: category },
    { data: offers },
    { data: payments },
    { data: conversations },
    { data: events },
  ] = await Promise.all([
    db
      .from('profiles')
      .select('id, full_name, phone')
      .eq('id', project.homeowner_id)
      .maybeSingle(),

    db
      .from('categories')
      .select('name')
      .eq('id', project.category_id)
      .maybeSingle(),

    db
      .from('offers')
      .select(
        'id, sender_id, sender_role, amount, timeline_days, status, kind, created_at',
      )
      .eq('project_id', project.id)
      .order('created_at', { ascending: false }),

    db
      .from('payments')
      .select(
        'id, payer_id, payee_id, total_amount, project_amount, protection_hold_amount, contractor_fee_amount, contractor_payout_amount, status, created_at',
      )
      .eq('project_id', project.id),

    db
      .from('conversations')
      .select('id, contractor_id')
      .eq('project_id', project.id),

    db
      .from('marketplace_events')
      .select('id, event_type, summary, created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  const offerRows = offers ?? [];
  const paymentRows = payments ?? [];
  const eventRows = events ?? [];

  const contractorIds = [
    ...new Set([
      ...offerRows
        .filter((offer) => offer.sender_role === 'contractor')
        .map((offer) => offer.sender_id)
        .filter(Boolean),
      ...(conversations ?? [])
        .map((conversation) => conversation.contractor_id)
        .filter(Boolean),
    ]),
  ];

  const { data: companies } = contractorIds.length
    ? await db
        .from('contractor_profiles')
        .select('user_id, company_name')
        .in('user_id', contractorIds)
    : { data: [] as any[] };

  const companyById = new Map(
    (companies ?? []).map((company) => [
      company.user_id,
      company.company_name,
    ]),
  );

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-6">
      <div className="mb-4">
        <BackLink href="/admin/projects" label="All projects" />
      </div>

      <AdminPageHeader
        eyebrow="Project"
        title={project.title}
        description={`${category?.name ?? 'Renovation'} · Homeowner ${
          homeowner?.full_name ?? '—'
        }`}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Pill value={project.status} />

        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
          Payment: {project.payment_status ?? '—'}
        </span>

        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
          Contractor fee: {project.contractor_fee_status ?? 'none'}
        </span>

        {project.zip_code && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
            ZIP {project.zip_code}
          </span>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="AI estimate"
          value={money(project.ai_estimate_min)}
          hint={`to ${money(project.ai_estimate_max)}`}
        />

        <StatCard
          label="Contractor fee"
          value={money(project.contractor_fee_amount)}
        />

        <StatCard
          label="Protection hold"
          value={money(project.protection_hold_amount)}
        />

        <StatCard label="Offers" value={offerRows.length} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Panel title="Project brief">
            <p className="whitespace-pre-wrap px-4 py-3 text-sm leading-6 text-slate-600">
              {project.description || 'No description provided.'}
            </p>

            <dl className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
              <Row label="Created" value={formatWhen(project.created_at)} />
              <Row label="Paid at" value={formatWhen(project.paid_at)} />
              <Row
                label="Commitment due"
                value={formatWhen(project.contractor_commit_due_at)}
              />
              <Row
                label="Completed at"
                value={formatWhen(project.completed_at)}
              />
            </dl>
          </Panel>

          <Panel
            title="Offer timeline"
            description={`${offerRows.length} offer(s)`}
          >
            {offerRows.length === 0 ? (
              <EmptyRow>No offers on this project.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-100">
                {offerRows.map((offer) => (
                  <li
                    key={offer.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900">
                          {money(offer.amount)}
                        </span>

                        <Pill value={offer.status} />
                      </div>

                      <p className="text-[11px] font-semibold text-slate-400">
                        {offer.sender_role === 'contractor'
                          ? companyById.get(offer.sender_id) ?? 'Contractor'
                          : 'Homeowner'}
                        {offer.timeline_days
                          ? ` · ${offer.timeline_days} days`
                          : ''}{' '}
                        · {formatWhen(offer.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Payment records"
            description={`${paymentRows.length} payment record(s)`}
          >
            {paymentRows.length === 0 ? (
              <EmptyRow>No payment record found.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-100">
                {paymentRows.map((payment) => (
                  <li key={payment.id} className="px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill value={payment.status ?? 'payment'} />

                          <span className="text-sm font-black text-slate-900">
                            {money(payment.total_amount)}
                          </span>
                        </div>

                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          Created {formatWhen(payment.created_at)}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                      <SmallRow
                        label="Project amount"
                        value={money(payment.project_amount)}
                      />
                      <SmallRow
                        label="Protection hold"
                        value={money(payment.protection_hold_amount)}
                      />
                      <SmallRow
                        label="Contractor fee"
                        value={money(payment.contractor_fee_amount)}
                      />
                      <SmallRow
                        label="Contractor payout"
                        value={money(payment.contractor_payout_amount)}
                      />
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Activity log" description={`${eventRows.length} event(s)`}>
            {eventRows.length === 0 ? (
              <EmptyRow>No marketplace events yet.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-100">
                {eventRows.map((event) => (
                  <li key={event.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill value={event.event_type ?? 'event'} />

                      <span className="text-sm font-bold text-slate-800">
                        {event.summary}
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {formatWhen(event.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel
            title="Admin controls"
            description="Review, release and refund controls for this project."
          >
            <div className="space-y-3 px-4 py-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Moderation
                </div>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Current review status:{' '}
                  <span className="font-black">
                    {project.moderation_status ?? 'pending'}
                  </span>
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={approveProject}>
                    <input type="hidden" name="id" value={project.id} />

                    <AdminActionButton
                      tone="emerald"
                      confirm="Approve and publish this project?"
                    >
                      Approve
                    </AdminActionButton>
                  </form>

                  <form action={rejectProject} className="flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={project.id} />

                    <input
                      name="note"
                      placeholder="Rejection reason"
                      className="h-9 w-40 rounded-xl border border-slate-200 px-3 text-xs font-semibold outline-none focus:border-slate-400"
                    />

                    <AdminActionButton
                      tone="rose"
                      confirm="Reject this project?"
                    >
                      Reject
                    </AdminActionButton>
                  </form>
                </div>
              </div>

              <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-3">
                <div className="text-xs font-black uppercase tracking-wide text-orange-700">
                  Escrow
                </div>

                <p className="mt-1 text-sm leading-6 text-orange-950/80">
                  Use only after reviewing messages, offers, payment record and
                  dispute context. These actions update payment and project
                  state.
                </p>

                <div className="mt-3 grid gap-2">
                  <form action={releaseProjectEscrow} className="flex gap-2">
                    <input
                      type="hidden"
                      name="projectId"
                      value={project.id}
                    />

                    <input
                      name="note"
                      placeholder="Release note"
                      className="h-9 min-w-0 flex-1 rounded-xl border border-orange-200 bg-white px-3 text-xs font-semibold outline-none focus:border-orange-400"
                    />

                    <AdminActionButton
                      tone="emerald"
                      confirm="Release held escrow to contractor?"
                    >
                      Release
                    </AdminActionButton>
                  </form>

                  <form action={refundProjectEscrow} className="flex gap-2">
                    <input
                      type="hidden"
                      name="projectId"
                      value={project.id}
                    />

                    <input
                      name="note"
                      placeholder="Refund note"
                      className="h-9 min-w-0 flex-1 rounded-xl border border-orange-200 bg-white px-3 text-xs font-semibold outline-none focus:border-orange-400"
                    />

                    <AdminActionButton
                      tone="rose"
                      confirm="Refund escrow to homeowner?"
                    >
                      Refund
                    </AdminActionButton>
                  </form>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Homeowner">
            <div className="px-4 py-4">
              <div className="text-sm font-black text-slate-900">
                {homeowner?.full_name ?? 'Unknown homeowner'}
              </div>

              <p className="mt-1 text-xs font-semibold text-slate-400">
                {homeowner?.phone ?? 'No phone number'}
              </p>

              {project.homeowner_id && (
                <Link
                  href={`/admin/users/${project.homeowner_id}`}
                  className="mt-3 inline-flex text-xs font-black text-orange-600 hover:underline"
                >
                  Open user profile
                </Link>
              )}
            </div>
          </Panel>

          <Panel title="Project details">
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="Project ID" value={project.id} />
              <Row label="Category" value={category?.name ?? '—'} />
              <Row label="ZIP" value={project.zip_code ?? '—'} />
              <Row label="City" value={project.city ?? '—'} />
              <Row label="Status" value={project.status ?? '—'} />
              <Row
                label="Payment status"
                value={project.payment_status ?? '—'}
              />
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 px-4 py-3">
      <dt className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </dt>

      <dd className="min-w-0 break-words text-sm font-semibold text-slate-700">
        {value || '—'}
      </dd>
    </div>
  );
}

function SmallRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="font-black text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-800">{value || '—'}</dd>
    </div>
  );
}