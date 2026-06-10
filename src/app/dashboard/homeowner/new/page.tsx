import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { countUnreadConversations } from '@/lib/unread';
import NewProjectForm from './form';
import type { Category } from '@/lib/types';

export default async function NewProjectPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [
    { data: categories, error: categoriesError },
    messageCount,
  ] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true }),

    countUnreadConversations(supabase, user.id, 'homeowner'),
  ]);

  if (categoriesError) {
    console.error('Categories query error:', categoriesError);
    throw new Error(categoriesError.message);
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <div className="flex min-h-screen">
        <DashboardSidebar
          role="homeowner"
          active="projects"
          messageCount={messageCount ?? 0}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1080px] px-5 py-5">
            <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-white px-6 py-7 text-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f45112]">
                      New project
                    </p>

                    <h1 className="mt-2 text-3xl font-black tracking-tight">
                      Tell us about your project
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Create a clear project brief, get a rough AI estimate and
                      collect structured contractor offers in one protected
                      marketplace flow.
                    </p>
                  </div>

                  <Link
                    href="/dashboard/homeowner"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Back to dashboard
                  </Link>
                </div>
              </div>

              <div className="grid gap-0 border-t border-slate-100 bg-white md:grid-cols-3">
                <HeroStep
                  number="01"
                  title="Describe the work"
                  text="Category, location, size, finish level and photos."
                />

                <HeroStep
                  number="02"
                  title="Get estimate"
                  text="Use AI only as a rough benchmark before real offers."
                />

                <HeroStep
                  number="03"
                  title="Compare offers"
                  text="Negotiate, accept and checkout through bidAI."
                />
              </div>
            </div>

            <Suspense
              fallback={
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm font-bold text-slate-500 shadow-sm">
                  Loading project form...
                </div>
              }
            >
              <NewProjectForm categories={(categories ?? []) as Category[]} />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

function HeroStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="border-b border-slate-100 px-6 py-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-sm font-black text-[#f45112]">
          {number}
        </div>

        <div>
          <h2 className="text-sm font-black text-slate-900">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
        </div>
      </div>
    </div>
  );
}