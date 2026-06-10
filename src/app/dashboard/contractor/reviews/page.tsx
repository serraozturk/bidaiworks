import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { relativeTime } from '@/lib/utils';
import { countUnreadConversations } from '@/lib/unread';

export default async function ContractorReviewsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'contractor') redirect('/dashboard');

  const [
    { data: reviews, error: reviewsError },
    conversationCount,
    { count: pendingOfferCount },
  ] = await Promise.all([
    supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        projects(id, title),
        reviewer:profiles!reviews_reviewer_id_fkey(full_name)
      `)
      .eq('contractor_id', user.id)
      .order('created_at', { ascending: false }),

    countUnreadConversations(supabase, user.id, 'contractor'),

    supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', user.id)
      .eq('sender_role', 'contractor')
      .in('status', ['pending', 'payment_pending', 'countered']),
  ]);

  if (reviewsError) {
    console.error('Contractor reviews query error:', reviewsError);
    throw new Error(reviewsError.message);
  }

  const rows = (reviews ?? []) as any[];

  const total = rows.length;

  const avgRating = total
    ? rows.reduce((sum, review) => sum + Number(review.rating ?? 0), 0) / total
    : 0;

  const breakdown = [5, 4, 3, 2, 1].map((star) => {
    const count = rows.filter((review) => Number(review.rating) === star).length;

    return {
      star,
      count,
      pct: total ? Math.round((count / total) * 100) : 0,
    };
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role="contractor"
          active="reviews"
          messageCount={conversationCount ?? 0}
          offerCount={pendingOfferCount ?? 0}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1200px] px-5 py-5">
            <header className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-white px-6 py-7 text-slate-900">
                <div className="flex flex-wrap items-end justify-between gap-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f45112]">
                      Customer reviews
                    </p>

                    <h1 className="mt-2 text-3xl font-black tracking-tight">
                      What homeowners are saying
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Verified reviews from homeowners who hired you through
                      bidAI.
                    </p>
                  </div>

                  <Link
                    href="/dashboard/contractor"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Back to dashboard
                  </Link>
                </div>
              </div>

              <div className="grid bg-white md:grid-cols-[280px_minmax(0,1fr)]">
                <div className="border-b border-slate-100 px-6 py-5 text-center md:border-b-0 md:border-r">
                  <div className="text-5xl font-black text-[#0f172a]">
                    {total ? avgRating.toFixed(1) : '—'}
                  </div>

                  <div className="mt-2 flex justify-center text-xl text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star}>
                        {avgRating >= star - 0.4 ? '★' : '☆'}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 text-xs font-bold text-slate-500">
                    {total} review{total === 1 ? '' : 's'}
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-3">
                    {breakdown.map((row) => (
                      <div key={row.star} className="flex items-center gap-3">
                        <div className="w-10 text-xs font-black text-slate-600">
                          {row.star} ★
                        </div>

                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-amber-400"
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>

                        <div className="w-10 text-right text-xs font-bold text-slate-500">
                          {row.count}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </header>

            {rows.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-orange-50 text-xl font-black text-[#f4510b]">
                  ★
                </div>

                <h2 className="mt-4 text-lg font-black text-[#0f172a]">
                  No reviews yet
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Once you complete a project, the homeowner can leave a verified
                  review here.
                </p>
              </div>
            ) : (
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-sm font-black text-[#0f172a]">
                    Review history
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Latest homeowner feedback from completed jobs.
                  </p>
                </div>

                <div className="divide-y divide-slate-100">
                  {rows.map((review) => {
                    const reviewerName =
                      firstRow<any>(review.reviewer)?.full_name ?? 'Homeowner';

                    const projectTitle =
                      firstRow<any>(review.projects)?.title ?? 'Project';

                    return (
                      <article key={review.id} className="px-5 py-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-lg text-amber-400">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span key={star}>
                                  {review.rating >= star ? '★' : '☆'}
                                </span>
                              ))}
                            </div>

                            <h3 className="mt-2 text-base font-black text-[#0f172a]">
                              {projectTitle}
                            </h3>

                            <p className="mt-0.5 text-xs font-bold text-slate-500">
                              {reviewerName} · {relativeTime(review.created_at)}
                            </p>
                          </div>

                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                            Verified
                          </span>
                        </div>

                        {review.comment && (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {review.comment}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}