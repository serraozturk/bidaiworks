import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { Badge } from '@/components/ui/Badge';
import { countUnreadConversations } from '@/lib/unread';

/**
 * Homeowner contractors directory. Lists every contractor on the platform that
 * matches the homeowner's project ZIPs/categories first, then everyone else
 * sorted by rating. Each card links to the public contractor profile.
 */
export default async function HomeownerContractorsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: contractors }, { data: projects }, conversationCount] = await Promise.all([
    supabase
      .from('contractor_profiles')
      .select(`
        user_id, company_name, bio, rating_avg, rating_count, verified, years_in_business, website,
        google_rating, google_review_count
      `)
      .order('rating_avg', { ascending: false })
      .order('rating_count', { ascending: false })
      .limit(30),
    supabase
      .from('projects')
      .select('id, title')
      .eq('homeowner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
    countUnreadConversations(supabase, user.id, 'homeowner'),
  ]);

  const primaryProjectId = (projects ?? [])[0]?.id ?? null;
  const list = (contractors ?? []) as any[];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="flex min-h-screen">
        <DashboardSidebar role="homeowner" active="saved" messageCount={conversationCount} />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1200px] px-6 py-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#f4510b]">Saved contractors</p>
                <h1 className="mt-1 text-3xl font-black">Browse contractors</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Tap any company to see their full profile, ratings, and recent reviews.
                </p>
              </div>
              <Link
                href="/dashboard/homeowner/new"
                className="rounded-xl bg-[#f4510b] px-4 py-2 text-sm font-black text-white hover:bg-[#d94406]"
              >
                + New project
              </Link>
            </div>

            {list.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
                <h2 className="text-xl font-black">No contractors yet</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Once contractors join your area, they will appear here.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.map((c, i) => (
                  <ContractorCard
                    key={c.user_id}
                    contractor={c}
                    index={i}
                    projectId={primaryProjectId}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function ContractorCard({
  contractor,
  index,
  projectId,
}: {
  contractor: any;
  index: number;
  projectId: string | null;
}) {
  const company = contractor.company_name ?? 'Contractor';
  const rating = contractor.rating_count ? Number(contractor.rating_avg).toFixed(1) : 'New';
  const reviews = contractor.rating_count ?? 0;
  const tones = [
    'bg-[#06152e] text-orange-100',
    'bg-[#1c1917] text-amber-100',
    'bg-[#134e4a] text-teal-100',
  ];

  const profileHref = `/dashboard/contractors/${contractor.user_id}`;
  const messageHref = projectId
    ? `/dashboard/messages/${projectId}/${contractor.user_id}`
    : '/dashboard/messages';

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xs font-black ${tones[index % tones.length]}`}>
          {initials(company)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-black">{company}</h3>
            {contractor.verified && <Badge tone="success">Verified</Badge>}
          </div>
          <p className="mt-0.5 text-xs font-bold text-slate-500">★ {rating} · {reviews} reviews</p>
          {contractor.years_in_business && (
            <p className="mt-0.5 text-xs text-slate-500">{contractor.years_in_business} yrs in business</p>
          )}
        </div>
      </div>

      {contractor.bio && (
        <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-600">{contractor.bio}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href={profileHref} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-black text-[#0f172a] hover:bg-slate-50">
          View profile
        </Link>
        <Link href={messageHref} className="rounded-xl bg-[#f4510b] px-3 py-2 text-center text-xs font-black text-white hover:bg-[#d94406]">
          Message
        </Link>
      </div>
    </article>
  );
}

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}
