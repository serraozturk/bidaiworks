import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AdminPageHeader,
  Panel,
  Pill,
  StatCard,
  EmptyRow,
  formatWhen,
  money,
} from '@/components/admin/ui';
import { AdminActionButton } from '@/components/admin/AdminActionButton';
import { actionFlag, createFlag, dismissFlag, warnUserFromFlag, suspendUserFromFlag } from '@/app/admin/actions';
import FlagsFilterList from './FlagsFilterList';

export const dynamic = 'force-dynamic';

/**
 * Unified moderation inbox: every signal that needs admin attention in
 * one place. Combines manually-stored `admin_flags` rows with live
 * computations like extreme-offer detection.
 */
export default async function AdminFlagsPage() {
  const db = createAdminClient();

  const [
    { data: flags },
    { data: offers },
    { data: projects },
    { data: categories },
    { data: profiles },
  ] = await Promise.all([
    db
      .from('admin_flags')
      .select(
        'id, kind, severity, status, project_id, offer_id, message_id, user_id, summary, detail, admin_note, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(100),
    db
      .from('offers')
      .select(
        'id, project_id, sender_id, sender_role, amount, status, created_at',
      )
      .in('status', ['pending', 'countered', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('projects').select('id, title, category_id, homeowner_id'),
    db.from('categories').select('id, name'),
    db.from('profiles').select('id, full_name, role, suspended'),
  ]);

  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  // ---- Live extreme-offer detection ----
  const byCategory = new Map<string, number[]>();
  for (const o of offers ?? []) {
    const project = projectById.get(o.project_id);
    const categoryId = project?.category_id ?? null;
    if (!categoryId) continue;
    const arr = byCategory.get(categoryId) ?? [];
    arr.push(Number(o.amount ?? 0));
    byCategory.set(categoryId, arr);
  }
  const medianByCategory = new Map<string, number>();
  for (const [cat, amounts] of byCategory) {
    if (amounts.length < 3) continue;
    const sorted = [...amounts].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    medianByCategory.set(cat, median);
  }

  const alreadyFlaggedOfferIds = new Set(
    (flags ?? [])
      .filter((f) => f.kind === 'extreme_offer' && f.status === 'open' && f.offer_id)
      .map((f) => f.offer_id as string),
  );

  type ExtremeOffer = {
    offer: NonNullable<typeof offers>[number];
    median: number;
    direction: 'too_high' | 'too_low';
    ratio: number;
  };
  const extremeOffers: ExtremeOffer[] = [];
  for (const o of offers ?? []) {
    if (alreadyFlaggedOfferIds.has(o.id)) continue;
    const project = projectById.get(o.project_id);
    const categoryId = project?.category_id ?? null;
    if (!categoryId) continue;
    const median = medianByCategory.get(categoryId);
    if (!median || median <= 0) continue;
    const amount = Number(o.amount ?? 0);
    const ratio = amount / median;
    if (ratio >= 2) {
      extremeOffers.push({ offer: o, median, direction: 'too_high', ratio });
    } else if (ratio > 0 && ratio <= 0.4) {
      extremeOffers.push({ offer: o, median, direction: 'too_low', ratio });
    }
  }
  extremeOffers.sort(
    (a, b) =>
      Math.max(b.ratio, 1 / Math.max(b.ratio, 0.001)) -
      Math.max(a.ratio, 1 / Math.max(a.ratio, 0.001)),
  );

  const flagRows = flags ?? [];
  const openFlags = flagRows.filter((f) => f.status === 'open');
  const resolvedFlags = flagRows.filter((f) => f.status !== 'open');
  const urgentOpen = openFlags.filter((f) => f.severity === 'urgent').length;

  // Count flags per user for context
  const flagCountByUser = new Map<string, number>();
  for (const f of flagRows) {
    if (f.user_id) {
      flagCountByUser.set(f.user_id, (flagCountByUser.get(f.user_id) ?? 0) + 1);
    }
  }

  const openFlagRows = openFlags.map((f) => {
    const target = describeTarget(f, { projectById, profileById });
    const userProfile = f.user_id ? (profileById.get(f.user_id) as any) : null;
    return {
      id: f.id,
      kind: f.kind,
      severity: f.severity ?? 'normal',
      summary: f.summary,
      detail: f.detail,
      created_at: f.created_at,
      user_id: f.user_id ?? null,
      userRole: (userProfile?.role as string | null) ?? null,
      userName: (userProfile?.full_name as string | null) ?? null,
      userSuspended: Boolean(userProfile?.suspended),
      userFlagCount: f.user_id ? (flagCountByUser.get(f.user_id) ?? 0) : 0,
      targetLabel: target.label,
      targetLinks: target.links,
    };
  });

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <AdminPageHeader
        eyebrow="Moderation"
        title="Flags & alerts"
        description="Everything that needs an admin decision in one place: extreme offers, off-platform contact attempts, reported users and any case you opened by hand."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Open flags"
          value={openFlags.length}
          tone={openFlags.length ? 'danger' : 'default'}
        />
        <StatCard
          label="Urgent open"
          value={urgentOpen}
          tone={urgentOpen ? 'danger' : 'default'}
        />
        <StatCard
          label="Extreme offers (live)"
          value={extremeOffers.length}
          tone={extremeOffers.length ? 'warning' : 'default'}
        />
        <StatCard label="Resolved" value={resolvedFlags.length} tone="success" />
      </div>

      <div className="mb-5">
        <FlagsFilterList
          rows={openFlagRows}
          actionFlagAction={actionFlag}
          dismissFlagAction={dismissFlag}
          warnUserAction={warnUserFromFlag}
          suspendUserAction={suspendUserFromFlag}
        />
      </div>

      <div className="mb-5">
        <Panel
          title="Extreme offers (live)"
          description={`Offers >2× or <0.4× the median for their category — possible scam, typo or price gouging. Limited to 50.`}
        >
          {extremeOffers.length === 0 ? (
            <EmptyRow>No extreme offers detected right now.</EmptyRow>
          ) : (
            <ul className="divide-y divide-slate-100">
              {extremeOffers.slice(0, 50).map(({ offer, median, direction, ratio }) => {
                const project = projectById.get(offer.project_id);
                const category = project
                  ? categoryById.get(project.category_id)
                  : null;
                const sender = profileById.get(offer.sender_id);
                return (
                  <li key={offer.id} className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill value={direction === 'too_high' ? 'too high' : 'too low'} />
                      <span className="text-sm font-black text-slate-900">
                        {money(offer.amount)} ·{' '}
                        <span className="text-orange-700">
                          {ratio.toFixed(1)}×
                        </span>{' '}
                        of category median ({money(median)})
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      {project?.title ?? 'Project'} ·{' '}
                      {category?.name ?? 'Uncategorized'} · from{' '}
                      {sender?.full_name ?? 'user'} ({offer.sender_role}) ·{' '}
                      {formatWhen(offer.created_at)}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={`/admin/projects/${offer.project_id}`}
                        className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Open project →
                      </Link>
                      <form action={createFlag}>
                        <input type="hidden" name="kind" value="extreme_offer" />
                        <input type="hidden" name="severity" value="high" />
                        <input
                          type="hidden"
                          name="projectId"
                          value={offer.project_id}
                        />
                        <input type="hidden" name="offerId" value={offer.id} />
                        <input type="hidden" name="userId" value={offer.sender_id} />
                        <input
                          type="hidden"
                          name="summary"
                          value={`Extreme offer ${ratio.toFixed(1)}× category median (${direction.replace('_', ' ')})`}
                        />
                        <input
                          type="hidden"
                          name="note"
                          value={`amount=${offer.amount}, median=${median}, direction=${direction}`}
                        />
                        <AdminActionButton
                          tone="orange"
                          confirm="Open a tracked flag for this offer?"
                        >
                          Open case
                        </AdminActionButton>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Resolved" description={`${resolvedFlags.length} closed`}>
        {resolvedFlags.length === 0 ? (
          <EmptyRow>No closed flags yet.</EmptyRow>
        ) : (
          <ul className="divide-y divide-slate-100">
            {resolvedFlags.slice(0, 25).map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill value={f.status} />
                    <Pill value={readable(f.kind)} />
                    <span className="text-sm font-bold text-slate-700">
                      {f.summary}
                    </span>
                  </div>
                  {f.admin_note && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Note: {f.admin_note}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                  {formatWhen(f.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function describeTarget(
  f: {
    project_id: string | null;
    offer_id: string | null;
    message_id: string | null;
    user_id: string | null;
  },
  ctx: {
    projectById: Map<string, any>;
    profileById: Map<string, any>;
  },
) {
  const links: { href: string; label: string }[] = [];
  const labelParts: string[] = [];

  if (f.project_id) {
    const p = ctx.projectById.get(f.project_id);
    labelParts.push(`project ${p?.title ?? f.project_id.slice(0, 8)}`);
    links.push({
      href: `/admin/projects/${f.project_id}`,
      label: 'Open project',
    });
  }
  if (f.user_id) {
    const u = ctx.profileById.get(f.user_id);
    labelParts.push(`user ${u?.full_name ?? f.user_id.slice(0, 8)}`);
    if (u?.role === 'contractor') {
      links.push({
        href: `/admin/contractors/${f.user_id}`,
        label: 'Open contractor',
      });
    } else if (u?.role === 'homeowner') {
      links.push({
        href: `/admin/users/${f.user_id}`,
        label: 'Open homeowner',
      });
    }
  }
  if (f.message_id) {
    labelParts.push(`message ${f.message_id.slice(0, 8)}`);
  }
  if (f.offer_id) {
    labelParts.push(`offer ${f.offer_id.slice(0, 8)}`);
  }

  return {
    label: labelParts.length > 0 ? labelParts.join(' · ') : 'no specific target',
    links,
  };
}

function readable(value: string) {
  return value.replaceAll('_', ' ');
}
