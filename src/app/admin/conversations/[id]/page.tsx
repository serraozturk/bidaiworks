import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  AdminPageHeader,
  Panel,
  Pill,
  EmptyRow,
  BackLink,
  formatWhen,
  money,
} from '@/components/admin/ui';
import { AdminActionButton } from '@/components/admin/AdminActionButton';
import {
  lockConversation,
  unlockConversation,
  redactMessage,
  unredactMessage,
  setUserMessagingDisabled,
} from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

export default async function AdminConversationDetailPage({ params }: Params) {
  const db = createAdminClient();

  const { data: conversation } = await db
    .from('conversations')
    .select(
      'id, project_id, homeowner_id, contractor_id, created_at, last_message_at, locked_at, locked_by, locked_reason',
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!conversation) notFound();

  const [
    { data: project },
    { data: homeowner },
    { data: company },
    { data: messages },
    { data: offers },
  ] = await Promise.all([
    db
      .from('projects')
      .select('id, title, status, zip_code, contractor_fee_status')
      .eq('id', conversation.project_id)
      .maybeSingle(),
    db
      .from('profiles')
      .select('id, full_name, messaging_disabled')
      .eq('id', conversation.homeowner_id)
      .maybeSingle(),
    db
      .from('contractor_profiles')
      .select('user_id, company_name')
      .eq('user_id', conversation.contractor_id)
      .maybeSingle(),
    db
      .from('messages')
      .select(
        'id, sender_id, content, kind, created_at, redacted_at, redacted_reason, original_content',
      )
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true }),
    db
      .from('offers')
      .select('id, sender_role, amount, timeline_days, status, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false }),
  ]);

  // Also look up the contractor's messaging_disabled state so the
  // sidebar mute controls reflect both parties.
  const { data: contractorOwner } = await db
    .from('profiles')
    .select('id, full_name, messaging_disabled')
    .eq('id', conversation.contractor_id)
    .maybeSingle();

  const homeownerName = homeowner?.full_name ?? 'Homeowner';
  const companyName = company?.company_name ?? 'Contractor';
  const isLocked = Boolean(conversation.locked_at);

  function senderLabel(senderId: string, kind: string | null) {
    if (kind === 'system') return 'System';
    if (senderId === conversation!.homeowner_id) return homeownerName;
    if (senderId === conversation!.contractor_id) return companyName;
    return 'Participant';
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6">
      <div className="mb-4">
        <BackLink href="/admin/conversations" label="All conversations" />
      </div>

      <AdminPageHeader
        eyebrow="Conversation"
        title={project?.title ?? 'Deal room'}
        description={`${homeownerName} ↔ ${companyName}`}
        action={
          project ? (
            <Link
              href={`/admin/projects/${project.id}`}
              className="inline-flex h-9 items-center rounded-xl bg-[#f45112] px-3 text-xs font-black text-white hover:bg-[#d94406]"
            >
              View project
            </Link>
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Pill value={project?.status} />
        {isLocked && (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black uppercase text-red-800">
            Conversation locked
          </span>
        )}
        {project?.zip_code && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
            ZIP {project.zip_code}
          </span>
        )}
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
          Started {formatWhen(conversation.created_at)}
        </span>
      </div>

      {isLocked && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">
          <div className="text-xs font-black uppercase tracking-wide text-red-800">
            Locked by bidAI
          </div>
          <p className="mt-1">
            {conversation.locked_reason ??
              'This conversation has been locked. Neither party can send new messages until you unlock it.'}
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          title="Message thread"
          description={`${(messages ?? []).length} message${
            (messages ?? []).length === 1 ? '' : 's'
          } — admin can hide any of them.`}
        >
          {(messages ?? []).length === 0 ? (
            <EmptyRow>No messages in this conversation.</EmptyRow>
          ) : (
            <ul className="space-y-3 px-4 py-4">
              {(messages ?? []).map((m) => {
                const isSystem = m.kind === 'system';
                const isRedacted = Boolean(m.redacted_at);
                return (
                  <li
                    key={m.id}
                    className={
                      isRedacted
                        ? 'rounded-xl border border-amber-200 bg-amber-50 px-3 py-2'
                        : isSystem
                          ? 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2'
                          : 'rounded-xl border border-slate-200 bg-white px-3 py-2'
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`text-[11px] font-black uppercase tracking-wide ${
                          isSystem ? 'text-slate-400' : 'text-orange-600'
                        }`}
                      >
                        {senderLabel(m.sender_id, m.kind)}
                        {m.kind && m.kind !== 'text' && m.kind !== 'system'
                          ? ` · ${m.kind}`
                          : ''}
                        {isRedacted && (
                          <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] text-amber-900">
                            redacted
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {formatWhen(m.created_at)}
                      </span>
                    </div>

                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {isRedacted
                        ? (m as any).original_content ?? m.content
                        : m.content}
                    </p>

                    {isRedacted && (
                      <p className="mt-1 text-[11px] font-semibold text-amber-800">
                        Visible to users as: “⚠️ removed by bidAI support” —
                        admin reason: {m.redacted_reason ?? 'none recorded'}
                      </p>
                    )}

                    {!isSystem && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {isRedacted ? (
                          <form action={unredactMessage}>
                            <input type="hidden" name="id" value={m.id} />
                            <input
                              type="hidden"
                              name="conversationId"
                              value={conversation.id}
                            />
                            <AdminActionButton
                              tone="slate"
                              confirm="Restore this message so users can see it again?"
                            >
                              Restore message
                            </AdminActionButton>
                          </form>
                        ) : (
                          <form
                            action={redactMessage}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input type="hidden" name="id" value={m.id} />
                            <input
                              type="hidden"
                              name="conversationId"
                              value={conversation.id}
                            />
                            <input
                              name="reason"
                              placeholder="Reason (visible only to admins)"
                              className="h-9 w-64 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                            />
                            <AdminActionButton
                              tone="rose"
                              confirm="Hide this message from both parties?"
                            >
                              Hide message
                            </AdminActionButton>
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel title="Conversation control">
            <div className="space-y-3 px-4 py-4 text-sm">
              {isLocked ? (
                <form action={unlockConversation}>
                  <input type="hidden" name="id" value={conversation.id} />
                  <p className="mb-2 text-xs leading-5 text-slate-600">
                    Locked {formatWhen(conversation.locked_at)}.
                  </p>
                  <AdminActionButton
                    tone="slate"
                    confirm="Unlock this conversation so messages can flow again?"
                  >
                    Unlock conversation
                  </AdminActionButton>
                </form>
              ) : (
                <form action={lockConversation} className="space-y-2">
                  <input type="hidden" name="id" value={conversation.id} />
                  <p className="text-xs leading-5 text-slate-600">
                    Lock to freeze all further messages while you investigate
                    (escrow, dispute, off-platform contact, abuse).
                  </p>
                  <input
                    name="reason"
                    placeholder="Lock reason (shown to users)"
                    className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
                  />
                  <AdminActionButton
                    tone="rose"
                    confirm="Lock this conversation? Neither party will be able to send messages."
                  >
                    Lock conversation
                  </AdminActionButton>
                </form>
              )}
            </div>
          </Panel>

          <Panel title="Participants">
            <div className="space-y-3 px-4 py-4 text-sm">
              <ParticipantRow
                label={`Homeowner — ${homeownerName}`}
                userId={conversation.homeowner_id}
                muted={Boolean((homeowner as any)?.messaging_disabled)}
                openHref={`/admin/users/${conversation.homeowner_id}`}
              />
              <ParticipantRow
                label={`Contractor — ${companyName}`}
                userId={conversation.contractor_id}
                muted={Boolean(contractorOwner?.messaging_disabled)}
                openHref={`/admin/contractors/${conversation.contractor_id}`}
              />
            </div>
          </Panel>

          <Panel title="Offers in this room" description={`${(offers ?? []).length} total`}>
            {(offers ?? []).length === 0 ? (
              <EmptyRow>No structured offers.</EmptyRow>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(offers ?? []).map((o) => (
                  <li key={o.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-slate-900">
                        {money(o.amount)}
                      </span>
                      <Pill value={o.status} />
                    </div>
                    <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                      {o.sender_role === 'contractor'
                        ? companyName
                        : homeownerName}{' '}
                      ·{' '}
                      {o.timeline_days ? `${o.timeline_days} days · ` : ''}
                      {formatWhen(o.created_at)}
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

function ParticipantRow({
  label,
  userId,
  muted,
  openHref,
}: {
  label: string;
  userId: string;
  muted: boolean;
  openHref: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-800">{label}</span>
        {muted && (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase text-rose-800">
            muted
          </span>
        )}
      </div>
      <form
        action={setUserMessagingDisabled}
        className="mt-2 flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="id" value={userId} />
        <input type="hidden" name="disabled" value={muted ? 'false' : 'true'} />
        {!muted && (
          <input
            name="reason"
            placeholder="Mute reason"
            className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
          />
        )}
        <AdminActionButton
          tone={muted ? 'slate' : 'rose'}
          confirm={muted ? 'Unmute this user?' : 'Mute this user (block from messaging)?'}
        >
          {muted ? 'Unmute' : 'Mute messaging'}
        </AdminActionButton>
      </form>
      {openHref && (
        <Link
          href={openHref}
          className="mt-2 inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
        >
          Open profile →
        </Link>
      )}
    </div>
  );
}
