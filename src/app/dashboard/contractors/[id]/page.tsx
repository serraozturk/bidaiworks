import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Badge } from '@/components/ui/Badge';
import { relativeTime } from '@/lib/utils';
import { MakeOfferButton } from '@/components/MakeOfferButton';
import { countUnreadConversations } from '@/lib/unread';

interface Params {
  params: { id: string };
}

export default async function ContractorProfilePage({ params }: Params) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: viewerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role =
    (viewerProfile?.role as 'homeowner' | 'contractor' | undefined) ??
    'homeowner';

  const [
    { data: contractor },
    { data: ownerProfile },
    { data: serviceAreas },
    { data: categories },
    { data: reviews },
    { data: activeProject },
    { data: bookedDeal },
    unreadMessages,
  ] = await Promise.all([
    supabase
      .from('contractor_profiles')
      .select(`
        user_id,
        company_name,
        license_number,
        license_status,
        bio,
        years_in_business,
        website,
        logo_url,
        cover_image_url,
        insurance_status,
        insurance_carrier,
        verified,
        rating_avg,
        rating_count,
        google_rating,
        google_review_count,
        google_profile_url,
        completed_jobs_count,
        response_time_hours
      `)
      .eq('user_id', params.id)
      .maybeSingle(),

    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', params.id)
      .maybeSingle(),

    supabase
      .from('contractor_service_areas')
      .select('zip_code, city, state')
      .eq('contractor_id', params.id),

    supabase
      .from('contractor_categories')
      .select('category_id, categories(name, slug)')
      .eq('contractor_id', params.id),

    supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        reviewer:profiles!reviews_reviewer_id_fkey(full_name),
        projects(title)
      `)
      .eq('contractor_id', params.id)
      .order('created_at', { ascending: false })
      .limit(12),

    role === 'homeowner'
      ? supabase
          .from('projects')
          .select('id, title, status, zip_code, categories(name)')
          .eq('homeowner_id', user.id)
          .in('status', ['open', 'in_review', 'quoted', 'negotiating', 'expired'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null },

    // Visibility rule: a homeowner only unlocks the contractor's direct
    // contact surface (external website, Google profile, owner name, license)
    // once they have booked this contractor through bidAI. A booked deal is
    // proven by a payment row from this homeowner to this contractor.
    role === 'homeowner'
      ? supabase
          .from('payments')
          .select('id')
          .eq('payer_id', user.id)
          .eq('payee_id', params.id)
          .limit(1)
          .maybeSingle()
      : { data: null },

    countUnreadConversations(supabase, user.id, role),
  ]);

  if (!contractor) notFound();

  // Contractors viewing the directory always see full detail; a homeowner
  // sees the contractor's contact surface only after booking them.
  const revealContact = role === 'contractor' || Boolean(bookedDeal);

  const company = contractor.company_name ?? 'Contractor';
  const project = activeProject as any | null;
  const projectId = project?.id ?? null;

  const ratingValue = contractor.rating_count
    ? Number(contractor.rating_avg).toFixed(1)
    : null;

  const reviewRows = (reviews ?? []) as any[];
  const serviceRows = (serviceAreas ?? []) as any[];
  const categoryRows = (categories ?? []) as any[];

  const backHref =
    role === 'homeowner'
      ? '/dashboard/contractors'
      : '/dashboard/contractor';

  const dealRoomHref =
    role === 'homeowner' && projectId
      ? `/dashboard/messages/${projectId}/${contractor.user_id}`
      : role === 'homeowner'
        ? '/dashboard/homeowner/new'
        : '/dashboard/contractor';

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role={role}
          active={role === 'homeowner' ? 'contractors' : 'dashboard'}
          messageCount={unreadMessages ?? 0}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1180px] px-5 py-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <Link
                href={backHref}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
              >
                ← Back
              </Link>

              {role === 'homeowner' && (
                <Link
                  href="/dashboard/homeowner/new"
                  className="inline-flex h-9 items-center rounded-lg bg-[#f45112] px-3 text-xs font-semibold text-white shadow-sm hover:bg-[#d94406]"
                >
                  New project
                </Link>
              )}
            </div>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="h-32 bg-slate-100">
                {contractor.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={contractor.cover_image_url}
                    alt={company}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>

              <div className="grid gap-5 px-5 pb-5 pt-0 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="min-w-0">
                  <div className="-mt-10 flex flex-wrap items-end gap-4">
                    <div className="grid h-20 w-20 place-items-center rounded-lg border-4 border-white bg-[#071631] text-xl font-black text-orange-100 shadow-sm">
                      {contractor.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={contractor.logo_url}
                          alt={company}
                          className="h-full w-full rounded-xl object-cover"
                        />
                      ) : (
                        initials(company)
                      )}
                    </div>

                    <div className="min-w-0 pb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="truncate text-2xl font-black tracking-tight md:text-3xl">
                          {company}
                        </h1>

                        {contractor.verified && (
                          <Badge tone="success">Verified</Badge>
                        )}

                        {contractor.license_status === 'verified' && (
                          <Badge tone="success">Licensed</Badge>
                        )}

                        {contractor.insurance_status === 'verified' && (
                          <Badge tone="success">Insured</Badge>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {revealContact
                          ? ((ownerProfile as any)?.full_name ?? 'Company owner')
                          : 'Company team'}
                        {contractor.years_in_business
                          ? ` · ${contractor.years_in_business} years in business`
                          : ''}
                      </p>
                    </div>
                  </div>

                  {contractor.bio && (
                    <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-600">
                      {contractor.bio}
                    </p>
                  )}

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat
                      label="bidAI rating"
                      value={ratingValue ?? 'New'}
                      hint={`${contractor.rating_count ?? 0} reviews`}
                    />

                    <Stat
                      label="Completed jobs"
                      value={String(contractor.completed_jobs_count ?? '—')}
                      hint="Marked complete"
                    />

                    <Stat
                      label="Service ZIPs"
                      value={String(serviceRows.length)}
                      hint="Covered areas"
                    />

                    <Stat
                      label="Response"
                      value={
                        contractor.response_time_hours
                          ? `${contractor.response_time_hours}h`
                          : '—'
                      }
                      hint="Typical reply"
                    />
                  </div>
                </div>

                <aside className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:mt-5">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Start safely
                  </div>

                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    Before checkout, use structured offers only. Direct chat
                    opens after payment is completed.
                  </p>

                  {role === 'homeowner' && !revealContact && (
                    <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] leading-4 text-slate-500">
                      The contractor&apos;s website, Google profile and owner
                      contact details unlock once you book this contractor
                      through bidAI checkout.
                    </p>
                  )}

                  <div className="mt-4 grid gap-2">
                    {role === 'homeowner' && projectId ? (
                      <MakeOfferButton
                        projectId={projectId}
                        projectTitle={project?.title ?? null}
                        contractorId={contractor.user_id}
                        contractorCompany={company}
                        contractorRating={contractor.rating_avg ?? null}
                        contractorReviewCount={contractor.rating_count ?? null}
                        contractorVerified={Boolean(contractor.verified)}
                        contractorBio={contractor.bio ?? null}
                        label="Send budget offer"
                        className="h-9 rounded-lg px-3 text-xs font-semibold"
                      />
                    ) : (
                      <Link
                        href={dealRoomHref}
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-[#f45112] px-3 text-xs font-semibold text-white hover:bg-[#d94406]"
                      >
                        {role === 'homeowner'
                          ? 'Create project first'
                          : 'Back to dashboard'}
                      </Link>
                    )}

                    {role === 'homeowner' && projectId && (
                      <Link
                        href={dealRoomHref}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                      >
                        Open deal room
                      </Link>
                    )}

                    {revealContact && contractor.website && (
                      <a
                        href={contractor.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                      >
                        Website
                      </a>
                    )}

                    {revealContact && contractor.google_profile_url && (
                      <a
                        href={contractor.google_profile_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                      >
                        Google profile
                      </a>
                    )}
                  </div>
                </aside>
              </div>
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-black text-slate-900">
                    Services
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Categories this contractor accepts on bidAI.
                  </p>

                  {categoryRows.length === 0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      No service categories listed yet.
                    </p>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {categoryRows.map((category: any) => (
                        <span
                          key={category.category_id}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700"
                        >
                          {firstRow<any>(category.categories)?.name ?? 'Service'}
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-black text-slate-900">
                        Reviews
                      </h2>

                      <p className="mt-0.5 text-xs text-slate-500">
                        Feedback from completed bidAI projects.
                      </p>
                    </div>

                    {ratingValue && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                        ★ {ratingValue} · {contractor.rating_count} reviews
                      </span>
                    )}
                  </div>

                  {reviewRows.length === 0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      No reviews yet.
                    </p>
                  ) : (
                    <div className="mt-4 divide-y divide-slate-100">
                      {reviewRows.map((review) => {
                        const reviewerName =
                          firstRow<any>(review.reviewer)?.full_name ??
                          'Homeowner';

                        const projectTitle =
                          firstRow<any>(review.projects)?.title ?? 'Project';

                        return (
                          <article
                            key={review.id}
                            className="py-4 first:pt-0 last:pb-0"
                          >
                            <div className="text-sm text-amber-400">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span key={star}>
                                  {review.rating >= star ? '★' : '☆'}
                                </span>
                              ))}
                            </div>

                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {reviewerName} · {projectTitle} ·{' '}
                              {relativeTime(review.created_at)}
                            </p>

                            {review.comment && (
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                {review.comment}
                              </p>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-5">
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-black text-slate-900">
                    Service area
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500">
                    ZIP areas covered by this contractor.
                  </p>

                  {serviceRows.length === 0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      Coverage ZIPs not provided yet.
                    </p>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {serviceRows.slice(0, 40).map((area: any, index: number) => (
                        <span
                          key={`${area.zip_code}-${index}`}
                          className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700"
                        >
                          {area.zip_code}
                          {area.city
                            ? ` · ${area.city}${area.state ? `, ${area.state}` : ''}`
                            : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                  <section className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
                  <div className="text-xs font-black uppercase tracking-wide text-red-700">
                    Platform rules
                  </div>

                  <p className="mt-2 text-xs leading-5 text-red-900/80">
                    Direct contact details are hidden until the contractor is
                    booked through bidAI checkout. Keep offers, negotiation and
                    project communication inside the platform.
                  </p>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-black text-slate-900">
                    Trust details
                  </h2>

                  <div className="mt-4 space-y-3 text-sm">
                    <InfoRow
                      label="License"
                      value={
                        revealContact
                          ? contractor.license_number || 'Not provided'
                          : contractor.license_status === 'verified'
                            ? 'Verified'
                            : 'Hidden until booking'
                      }
                    />

                    <InfoRow
                      label="Insurance"
                      value={
                        contractor.insurance_status === 'verified'
                          ? 'Verified'
                          : contractor.insurance_status || 'Not provided'
                      }
                    />

                    <InfoRow
                      label="Insurance carrier"
                      value={
                        revealContact
                          ? contractor.insurance_carrier || 'Not provided'
                          : contractor.insurance_status === 'verified'
                            ? 'Verified carrier'
                            : 'Hidden until booking'
                      }
                    />

                    <InfoRow
                      label="Google rating"
                      value={
                        contractor.google_rating
                          ? `${contractor.google_rating} · ${
                              contractor.google_review_count ?? 0
                            } reviews`
                          : 'Not connected'
                      }
                    />
                  </div>
                </section>
              </aside>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-lg font-black text-slate-900">
        {value}
      </div>

      <div className="mt-0.5 text-xs font-semibold text-slate-500">
        {hint}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-xs font-bold text-slate-500">
        {label}
      </span>

      <span className="max-w-[180px] text-right text-xs font-black text-slate-900">
        {value}
      </span>
    </div>
  );
}

function initials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

               