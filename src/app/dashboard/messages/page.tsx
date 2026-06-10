import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '@/components/DashboardSidebar';

export default async function MessagesInbox() {
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

  const role =
    (profile?.role as 'homeowner' | 'contractor' | undefined) ?? 'homeowner';

  const isContractor = role === 'contractor';

  /**
   * Main source of truth:
   * If the user is homeowner OR contractor in any conversation,
   * redirect to the latest conversation.
   */
  const { data: conversations, error: conversationError } = await supabase
    .from('conversations')
    .select(`
      id,
      project_id,
      homeowner_id,
      contractor_id,
      last_message_at,
      created_at
    `)
    .or(`homeowner_id.eq.${user.id},contractor_id.eq.${user.id}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1);

  if (conversationError) {
    console.error(
      'Messages inbox conversation error:',
      conversationError.message,
    );
  }

  if (conversations && conversations.length > 0) {
    const first: any = conversations[0];

    const partnerId =
      first.homeowner_id === user.id
        ? first.contractor_id
        : first.homeowner_id;

    redirect(`/dashboard/messages/${first.project_id}/${partnerId}`);
  }

  /**
   * Offers-centered fallback for homeowner:
   * If no conversation exists but offers exist on homeowner projects,
   * open the latest offer's contractor thread.
   */
  if (role === 'homeowner') {
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('homeowner_id', user.id);

    const projectIds = (projects ?? []).map((project) => project.id);

    if (projectIds.length > 0) {
      const { data: latestOffer } = await supabase
        .from('offers')
        .select(`
          project_id,
          sender_id,
          sender_role,
          recipient_id,
          recipient_role,
          conversation_id,
          created_at
        `)
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestOffer?.project_id) {
        const partnerId =
          latestOffer.sender_role === 'contractor'
            ? latestOffer.sender_id
            : latestOffer.recipient_id;

        if (partnerId) {
          redirect(`/dashboard/messages/${latestOffer.project_id}/${partnerId}`);
        }
      }
    }
  }

  /**
   * Offers-centered fallback for contractor:
   * If no conversation exists but contractor sent or received offers,
   * open latest offer's homeowner thread.
   */
  if (role === 'contractor') {
    const { data: latestOffer } = await supabase
      .from('offers')
      .select(`
        project_id,
        sender_id,
        sender_role,
        recipient_id,
        recipient_role,
        conversation_id,
        created_at,
        projects(homeowner_id)
      `)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const project = firstRow<any>((latestOffer as any)?.projects);

    if (latestOffer?.project_id && project?.homeowner_id) {
      redirect(`/dashboard/messages/${latestOffer.project_id}/${project.homeowner_id}`);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="flex">
        <DashboardSidebar role={role} active="messages" />

        <div className="min-w-0 flex-1 px-4 py-10 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-orange-50 text-2xl text-brand-700">
                ○
              </div>

              <h1 className="mt-5 text-2xl font-black text-ink-900">
                No messages yet
              </h1>

              <p className="mt-2 text-ink-600">
                {isContractor
                  ? 'Conversations appear here when you send an offer or receive a budget request from a homeowner.'
                  : 'Conversations appear here when you send a budget request or a contractor sends you an offer.'}
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href={isContractor ? '/dashboard/contractor' : '/dashboard/homeowner'}
                  className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-black text-white hover:bg-brand-700"
                >
                  {isContractor ? 'Browse open projects' : 'Open dashboard'}
                </Link>

                {!isContractor && (
                  <Link
                    href="/dashboard/homeowner/new"
                    className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-ink-800 hover:bg-slate-50"
                  >
                    Start a new project
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}