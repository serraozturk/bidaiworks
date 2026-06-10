import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Badge } from '@/components/ui/Badge';
import { relativeTime } from '@/lib/utils';
import { countUnreadConversations } from '@/lib/unread';

type CompletedProjectRow = {
  id: string;
  title: string;
  status: string;
  selected_offer_id: string | null;
  awarded_offer_id: string | null;
};

type OfferRow = {
  id: string;
  sender_id: string;
  sender_role: 'homeowner' | 'contractor';
  recipient_id: string | null;
  recipient_role: 'homeowner' | 'contractor' | null;
};

type ContractorInfo = {
  user_id: string;
  company_name: string | null;
};

export default async function HomeownerReviewsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: reviews }, { data: completedProjects }, conversationCount] =
    await Promise.all([
      supabase
        .from('reviews')
        .select(
          `
          id,
          rating,
          comment,
          created_at,
          project_id,
          contractor_id,
          projects(title, status)
        `,
        )
        .eq('reviewer_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('projects')
        .select(
          `
          id,
          title,
          status,
          selected_offer_id,
          awarded_offer_id
        `,
        )
        .eq('homeowner_id', user.id)
        .in('status', ['completed', 'paid', 'in_progress'])
        .order('created_at', { ascending: false }),

      countUnreadConversations(supabase, user.id, 'homeowner'),
    ]);

  const reviewRows = (reviews ?? []) as any[];
  const projectRows = (completedProjects ?? []) as CompletedProjectRow[];

  const reviewedProjectIds = new Set(
    reviewRows.map((review) => review.project_id),
  );

  const pendingReviews = projectRows.filter(
    (project) => project.status === 'completed' && !reviewedProjectIds.has(project.id),
  );

  const acceptedOfferIds = pendingReviews
    .map((project) => project.awarded_offer_id ?? project.selected_offer_id)
    .filter((id): id is string => Boolean(id));

  let pendingWithContractor: Array<
    CompletedProjectRow & {
      contractorName: string;
      contractorId: string | null;
    }
  > = pendingReviews.map((project) => ({
    ...project,
    contractorName: 'Contractor',
    contractorId: null,
  }));

  if (acceptedOfferIds.length > 0) {
    const { data: acceptedOffers, error: offersError } = await supabase
      .from('offers')
      .select(
        `
        id,
        sender_id,
        sender_role,
        recipient_id,
        recipient_role
      `,
      )
      .in('id', acceptedOfferIds);

    if (offersError) {
      console.error('Review accepted offers query error:', offersError);
      throw new Error(offersError.message);
    }

    const offerRows = (acceptedOffers ?? []) as OfferRow[];

    const offerById = new Map(offerRows.map((offer) => [offer.id, offer]));

    const contractorIds = Array.from(
      new Set(
        offerRows
          .map((offer) => getContractorIdFromOffer(offer))
          .filter((id): id is string => Boolean(id)),
      ),
    );

    let contractorById = new Map<string, ContractorInfo>();

    if (contractorIds.length > 0) {
      const { data: contractors, error: contractorsError } = await supabase
        .from('contractor_profiles')
        .select('user_id, company_name')
        .in('user_id', contractorIds);

      if (contractorsError) {
        console.error('Review contractor query error:', contractorsError);
        throw new Error(contractorsError.message);
      }

      contractorById = new Map(
        ((contractors ?? []) as ContractorInfo[]).map((contractor) => [
          contractor.user_id,
          contractor,
        ]),
      );
    }

    pendingWithContractor = pendingReviews.map((project) => {
      const offerId = project.awarded_offer_id ?? project.selected_offer_id;
      const offer = offerId ? offerById.get(offerId) : null;
      const contractorId = offer ? getContractorIdFromOffer(offer) : null;
      const contractor = contractorId ? contractorById.get(contractorId) : null;

      return {
        ...project,
        contractorId,
        contractorName: contractor?.company_name ?? 'Contractor',
      };
    });
  }

  const total = reviewRows.length;

  const avgRating = total
    ? reviewRows.reduce(
        (sum: number, review: any) => sum + Number(review.rating ?? 0),
        0,
      ) / total
    : 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role="homeowner"
          active="reviews"
          messageCount={conversationCount ?? 0}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1080px] px-6 py-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#f4510b]">
                  Your reviews
                </p>

                <h1 className="mt-1 text-3xl font-black">
                  Reviews you have written
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Reviews become available after a project is marked completed.
                </p>
              </div>

              <Link
                href="/dashboard/homeowner"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Back to dashboard
              </Link>
            </div>

            <section className="mb-6 grid gap-3 md:grid-cols-3">
              <Stat
                label="Reviews written"
                value={String(total)}
                hint={total ? 'Helping other homeowners' : 'No reviews yet'}
              />

              <Stat
                label="Average rating"
                value={total ? `${avgRating.toFixed(1)} ★` : '—'}
                hint="Your average contractor rating"
              />

              <Stat
                label="Pending"
                value={String(pendingWithContractor.length)}
                hint="Completed projects to review"
              />
            </section>

            {pendingWithContractor.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-lg font-black">
                  Waiting for your review
                </h2>

                <div className="grid gap-3 md:grid-cols-2">
                  {pendingWithContractor.map((project) => (
                    <Link
                      key={project.id}
                      href={`/dashboard/homeowner/projects/${project.id}`}
                      className="block rounded-lg border border-orange-200 bg-orange-50/50 p-4 transition hover:bg-orange-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-black">
                            {project.title}
                          </h3>

                          <p className="mt-0.5 text-xs text-slate-600">
                            {project.contractorName} · completed
                          </p>
                        </div>

                        <span className="shrink-0 text-sm font-black text-[#c94106]">
                          Leave review →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-lg font-black">Past reviews</h2>

              {reviewRows.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-orange-50 text-xl text-[#f4510b]">
                    ★
                  </div>

                  <h3 className="mt-4 text-base font-black">
                    No reviews yet
                  </h3>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Once a paid project is completed, you can leave a review for
                    the contractor from the project detail page.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviewRows.map((review) => {
                    const project = firstRow<any>(review.projects);

                    return (
                      <article
                        key={review.id}
                        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-base text-amber-400">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span key={star}>
                                  {review.rating >= star ? '★' : '☆'}
                                </span>
                              ))}
                            </div>

                            <h3 className="mt-2 text-sm font-black">
                              {project?.title ?? 'Project'}
                            </h3>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {relativeTime(review.created_at)}
                            </p>
                          </div>

                          <Badge tone="success">{review.rating}/5</Badge>
                        </div>

                        {review.comment && (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {review.comment}
                          </p>
                        )}

                        <div className="mt-3 flex justify-end">
                          <Link
                            href={`/dashboard/homeowner/projects/${review.project_id}`}
                            className="text-xs font-black text-[#f4510b] hover:underline"
                          >
                            View project →
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
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
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-3xl font-black tracking-tight">
        {value}
      </div>

      <div className="mt-1 text-xs font-bold text-slate-500">
        {hint}
      </div>
    </div>
  );
}

function getContractorIdFromOffer(offer: OfferRow): string | null {
  if (offer.sender_role === 'contractor') return offer.sender_id;
  if (offer.recipient_role === 'contractor') return offer.recipient_id;
  return null;
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}