import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MessageThread from '@/components/messages/MessageThread';
import DealPanel from '@/components/messages/DealPanel';
import ConversationList, {
  type ConversationItem,
} from '@/components/messages/ConversationList';
import { DashboardSidebar } from '@/components/DashboardSidebar';

interface Params {
  params: {
    projectId: string;
    partnerId: string;
  };
}

type UserRole = 'homeowner' | 'contractor';

export default async function MessagesPage({ params }: Params) {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect('/login');

  // Recover any stale payment / commitment windows before rendering.
  await supabase.rpc('expire_stale_deals').then(() => undefined, () => undefined);

  const { data: me, error: meError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (meError || !me) notFound();

  const role = me.role as UserRole;

  if (role !== 'homeowner' && role !== 'contractor') {
    notFound();
  }

  const homeownerId = role === 'homeowner' ? user.id : params.partnerId;
  const contractorId = role === 'contractor' ? user.id : params.partnerId;

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select(`
      id,
      title,
      homeowner_id,
      status,
      zip_code,
      selected_offer_id,
      awarded_offer_id,
      categories(name)
    `)
    .eq('id', params.projectId)
    .maybeSingle();

  if (projectError) {
    console.error('Current project query error:', projectError);
    throw new Error(`Current project query failed: ${projectError.message}`);
  }

  let { data: conv, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('project_id', params.projectId)
    .eq('homeowner_id', homeownerId)
    .eq('contractor_id', contractorId)
    .maybeSingle();

  if (convError) {
    console.error('Active conversation query error:', convError);
    throw new Error(`Active conversation query failed: ${convError.message}`);
  }

  if (!conv) {
    if (!project || project.homeowner_id !== homeownerId) {
      notFound();
    }

    const { data: created, error: createConversationError } = await supabase
      .from('conversations')
      .insert({
        project_id: project.id,
        homeowner_id: homeownerId,
        contractor_id: contractorId,
        last_message_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (createConversationError || !created) {
      console.error('Create conversation error:', createConversationError);
      throw new Error(
        `Create conversation failed: ${
          createConversationError?.message ?? 'Unknown error'
        }`,
      );
    }

    conv = created;
  }

  const readColumn =
    role === 'homeowner'
      ? { last_read_homeowner_at: new Date().toISOString() }
      : { last_read_contractor_at: new Date().toISOString() };

  const { error: readUpdateError } = await supabase
    .from('conversations')
    .update(readColumn)
    .eq('id', conv.id);

  if (readUpdateError) {
    console.error('Conversation read timestamp update error:', readUpdateError);
  }

  const [
    conversationsResult,
    messagesResult,
    offersResult,
    partnerProfileResult,
  ] = await Promise.all([
    supabase
      .from('conversations')
      .select(`
        id,
        project_id,
        homeowner_id,
        contractor_id,
        last_message_at,
        last_read_homeowner_at,
        last_read_contractor_at
      `)
      .or(`homeowner_id.eq.${user.id},contractor_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false }),

    supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        kind,
        offer_id,
        created_at
      `)
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true }),

    supabase
      .from('offers')
      .select(`
        id,
        project_id,
        conversation_id,
        parent_offer_id,
        sender_id,
        sender_role,
        recipient_id,
        recipient_role,
        kind,
        amount,
        timeline_days,
        status,
        scope_summary,
        included_items,
        excluded_items,
        notes,
        message,
        contractor_fee_amount,
        contractor_fee_status,
        accepted_at,
        rejected_at,
        expired_at,
        responded_at,
        created_at
      `)
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false }),

    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', params.partnerId)
      .maybeSingle(),
  ]);

  if (conversationsResult.error) {
    console.error('Conversations query error:', conversationsResult.error);
    throw new Error(
      `Conversations query failed: ${conversationsResult.error.message}`,
    );
  }

  if (messagesResult.error) {
    console.error('Messages query error:', messagesResult.error);
    throw new Error(`Messages query failed: ${messagesResult.error.message}`);
  }

  if (offersResult.error) {
    console.error('Offers query error:', offersResult.error);
    throw new Error(`Offers query failed: ${offersResult.error.message}`);
  }

  if (partnerProfileResult.error) {
    console.error('Partner profile query error:', partnerProfileResult.error);
  }

  const conversations = conversationsResult.data ?? [];
  const messages = messagesResult.data ?? [];
  const offers = offersResult.data ?? [];
  const partnerProfile = partnerProfileResult.data ?? null;

  const projectIds = Array.from(
    new Set(
      conversations
        .map((conversation: any) => conversation.project_id)
        .filter(Boolean),
    ),
  );

  const { data: projectRows, error: projectRowsError } = projectIds.length
    ? await supabase
        .from('projects')
        .select(`
          id,
          title,
          status,
          selected_offer_id,
          awarded_offer_id
        `)
        .in('id', projectIds)
    : { data: [], error: null };

  if (projectRowsError) {
    console.error('Project rows query error:', projectRowsError);
    throw new Error(`Project rows query failed: ${projectRowsError.message}`);
  }

  const projectById = new Map(
    ((projectRows ?? []) as any[]).map((row) => [row.id, row]),
  );

  const allUserIds = Array.from(
    new Set(
      conversations
        .flatMap((conversation: any) => [
          conversation.homeowner_id,
          conversation.contractor_id,
        ])
        .filter(Boolean),
    ),
  );

  const [profileRowsResult, contractorProfileRowsResult] = await Promise.all([
    allUserIds.length
      ? supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', allUserIds)
      : Promise.resolve({ data: [] as any[], error: null }),

    allUserIds.length
      ? supabase
          .from('contractor_profiles')
          .select('user_id, company_name')
          .in('user_id', allUserIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  if (profileRowsResult.error) {
    console.error('Profile rows query error:', profileRowsResult.error);
    throw new Error(
      `Profile rows query failed: ${profileRowsResult.error.message}`,
    );
  }

  if (contractorProfileRowsResult.error) {
    console.error(
      'Contractor profile rows query error:',
      contractorProfileRowsResult.error,
    );
    throw new Error(
      `Contractor profile rows query failed: ${contractorProfileRowsResult.error.message}`,
    );
  }

  const profileNameById = new Map<string, string>(
    ((profileRowsResult.data ?? []) as any[]).map((profile) => [
      profile.id,
      firstPresentName(profile.full_name, 'Unknown contact'),
    ]),
  );

  const contractorCompanyById = new Map<string, string>(
    ((contractorProfileRowsResult.data ?? []) as any[]).map((profile) => [
      profile.user_id,
      firstPresentName(profile.company_name),
    ]),
  );

  const activeConversation = conversations.find((c: any) => c.id === conv.id) as
    | any
    | undefined;

  const activeProjectInfo = activeConversation
    ? projectById.get(activeConversation.project_id)
    : null;

  const partnerName =
    conv.homeowner_id === user.id
      ? firstPresentName(
          contractorCompanyById.get(conv.contractor_id),
          profileNameById.get(conv.contractor_id),
          partnerProfile?.full_name,
          'Contractor',
        )
      : firstPresentName(
          profileNameById.get(conv.homeowner_id),
          partnerProfile?.full_name,
          'Homeowner',
        );

  const displayName = firstPresentName(partnerName, 'Conversation');

  const projectTitle =
    project?.title || activeProjectInfo?.title || 'Project conversation';

  const rawProjectStatus = (project?.status as string | undefined) ?? 'open';
  const displayProjectStatus = rawProjectStatus.replaceAll('_', ' ');

  const projectZip = project?.zip_code ? `ZIP ${project.zip_code}` : '';

  const messageCount = conversations.reduce((unread: number, c: any) => {
    const isHomeowner = c.homeowner_id === user.id;

    const readAt = isHomeowner
      ? c.last_read_homeowner_at
      : c.last_read_contractor_at;

    if (!c.last_message_at) return unread;

    if (!readAt || new Date(c.last_message_at) > new Date(readAt)) {
      return unread + 1;
    }

    return unread;
  }, 0);

  const conversationItems: ConversationItem[] = conversations.map((c: any) => {
    const isHomeowner = c.homeowner_id === user.id;
    const visiblePartnerId = isHomeowner ? c.contractor_id : c.homeowner_id;

    const contractorCompanyName = contractorCompanyById.get(c.contractor_id);
    const contractorProfileName = profileNameById.get(c.contractor_id);
    const homeownerProfileName = profileNameById.get(c.homeowner_id);

    const visiblePartnerName = isHomeowner
      ? firstPresentName(
          contractorCompanyName,
          contractorProfileName,
          'Contractor',
        )
      : firstPresentName(homeownerProfileName, 'Homeowner');

    const projectInfo = projectById.get(c.project_id);

    const readAt = isHomeowner
      ? c.last_read_homeowner_at
      : c.last_read_contractor_at;

    return {
      id: String(c.id),
      projectId: String(c.project_id),
      partnerId: String(visiblePartnerId),
      partnerName: visiblePartnerName || 'Unknown contact',
      projectTitle: firstPresentName(
        projectInfo?.title,
        'Project conversation',
      ),
      projectStatus: projectInfo?.status as string | undefined,
      lastMessageAt: c.last_message_at ?? null,
      unread: c.last_message_at
        ? new Date(c.last_message_at) > new Date(readAt ?? 0)
        : false,
      selected: c.id === conv.id,
    };
  });

  const offerRows = ((offers ?? []) as any[]).sort(
    (a, b) =>
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime(),
  );

  const activePendingOffer =
    offerRows.find((offer) => offer.status === 'pending') ?? null;

  const needsMyOfferResponse =
    activePendingOffer && activePendingOffer.sender_role !== role;

  const offerCount = needsMyOfferResponse ? 1 : 0;

  const projectHref =
    role === 'homeowner'
      ? `/dashboard/homeowner/projects/${params.projectId}?returnTo=${encodeURIComponent(
          `/dashboard/messages/${params.projectId}/${params.partnerId}`,
        )}`
      : `/dashboard/contractor/projects/${params.projectId}?returnTo=${encodeURIComponent(
          `/dashboard/messages/${params.projectId}/${params.partnerId}`,
        )}`;

  const compareHref = `/dashboard/homeowner/compare?project=${params.projectId}`;

  const normalizedProjectStatus = project?.status ?? 'open';

  const canCompareOffers =
    role === 'homeowner' &&
    ['open', 'in_review', 'quoted', 'negotiating'].includes(
      normalizedProjectStatus,
    );

  const awardedOfferId =
    (project?.awarded_offer_id as string | null | undefined) ?? null;

  const selectedOfferId =
    (project?.selected_offer_id as string | null | undefined) ?? null;

  const awardedOffer = awardedOfferId
    ? offerRows.find((offer) => offer.id === awardedOfferId) ?? null
    : null;

  const selectedOffer = selectedOfferId
    ? offerRows.find((offer) => offer.id === selectedOfferId) ?? null
    : null;

  const paymentPendingOffer =
    offerRows.find((offer) => offer.status === 'payment_pending') ?? null;

  const reservedOffer = awardedOffer ?? selectedOffer ?? paymentPendingOffer;

  // Fetch contractor contact details — only for homeowners on in_progress/completed projects
  const projectStatusForContact = project?.status ?? 'open';
  let contractorContact: {
    phone?: string | null;
    website?: string | null;
    address_line?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  } | null = null;

  if (
    role === 'homeowner' &&
    (projectStatusForContact === 'in_progress' || projectStatusForContact === 'completed')
  ) {
    const { data: cpContact } = await supabase
      .from('contractor_profiles')
      .select('phone, website, address_line, city, state, zip_code')
      .eq('user_id', contractorId)
      .maybeSingle();
    if (cpContact) contractorContact = cpContact;
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f6f8fb] text-ink-900">
      <div className="flex h-full">
        <DashboardSidebar
          role={role}
          active="messages"
          messageCount={messageCount}
          offerCount={offerCount}
        />

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden px-2 py-3 lg:px-3 xl:px-4">
            <div className="mx-auto grid h-full w-full max-w-none gap-3 lg:grid-cols-[280px_minmax(0,1fr)_280px] xl:grid-cols-[290px_minmax(0,1fr)_290px]">
              <aside className="hidden min-h-0 flex-col overflow-visible rounded-lg border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] ring-1 ring-white lg:flex">
                <div className="border-b border-slate-100 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h1 className="truncate text-lg font-black tracking-tight text-ink-900">
                        Messages
                      </h1>

                      <p className="mt-1 truncate text-xs font-medium text-slate-500">
                        All project conversations
                      </p>
                    </div>

                    {messageCount > 0 && (
                      <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-orange-600 px-2 text-[10px] font-black text-white shadow-sm">
                        {messageCount}
                      </span>
                    )}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-visible px-3 py-3">
                  <ConversationList items={conversationItems} />
                </div>
              </aside>

              <main className="min-h-0 overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-[0_14px_44px_rgba(15,23,42,0.07)] ring-1 ring-white lg:flex lg:flex-col">
                <div className="border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={displayName} active />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-black tracking-tight text-ink-900">
                            {displayName}
                          </h2>

                          <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black capitalize text-emerald-700 sm:inline-flex">
                            {displayProjectStatus}
                          </span>
                        </div>

                        <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                          {projectTitle}
                          {projectZip ? ` · ${projectZip}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={projectHref}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-ink-800 shadow-sm transition hover:bg-slate-50"
                      >
                        View project
                        <ExternalIcon />
                      </Link>

                      {canCompareOffers && (
                        <Link
                          href={compareHref}
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-3 text-xs font-black text-orange-700 shadow-sm transition hover:bg-orange-100"
                        >
                          Compare offers
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {project?.status === 'pending_payment' &&
                  role === 'contractor' &&
                  reservedOffer && (
                    <AwardedBanner
                      role="contractor"
                      isWinner={reservedOffer.sender_id === user.id}
                    />
                  )}

                <div className="min-h-0 flex-1 bg-slate-50 p-3">
                  <MessageThread
                    conversationId={conv.id}
                    currentUserId={user.id}
                    currentUserRole={role}
                    initialMessages={messages}
                    offers={offerRows}
                    projectStatus={project?.status ?? null}
                  />
                </div>
              </main>

              <aside className="hidden min-h-0 overflow-hidden lg:block">
                <DealPanel
                  role={role}
                  projectId={params.projectId}
                  projectTitle={projectTitle}
                  projectStatus={(project?.status as string | undefined) ?? 'open'}
                  zipCode={project?.zip_code ?? null}
                  category={firstRow<any>(project?.categories)?.name ?? null}
                  awardedOfferId={awardedOfferId}
                  selectedOfferId={selectedOfferId}
                  partnerId={params.partnerId}
                  partnerName={displayName}
                  contractorContact={contractorContact}
                  offers={offerRows.map((offer: any) => ({
                    id: offer.id,
                    amount: Number(offer.amount),
                    timeline_days: offer.timeline_days,
                    status: offer.status,
                    sender_role: offer.sender_role,
                    recipient_role: offer.recipient_role,
                    kind: offer.kind,
                    scope_summary: offer.scope_summary,
                    included_items: offer.included_items,
                    excluded_items: offer.excluded_items,
                    notes: offer.notes,
                    message: offer.message,
                    created_at: offer.created_at,
                  }))}
                />
              </aside>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Avatar({ name, active = false }: { name: string; active?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-xs font-black shadow-sm ${
        active
          ? 'bg-[#071631] text-orange-100'
          : 'bg-slate-100 text-ink-700'
      }`}
    >
      {initials || '?'}
    </div>
  );
}

function AwardedBanner({
  role,
  isWinner,
}: {
  role: 'homeowner' | 'contractor';
  isWinner: boolean;
}) {
  if (role === 'contractor' && isWinner) {
    return (
      <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black text-emerald-800">
              You won this project.
            </div>

            <div className="text-[11px] font-medium text-emerald-700">
              The homeowner accepted your offer. The job becomes active after
              checkout is completed.
            </div>
          </div>

          <Link
            href="/dashboard/contractor/jobs"
            className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-sm transition hover:bg-emerald-700"
          >
            View accepted jobs
          </Link>
        </div>
      </div>
    );
  }

  if (role === 'contractor' && !isWinner) {
    return (
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600">
        The homeowner accepted another offer for this project.
      </div>
    );
  }

  return null;
}

function firstRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function firstPresentName(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();

    if (trimmed) return trimmed;
  }

  return '';
}

function ExternalIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14 4h6v6M20 4l-9 9M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
