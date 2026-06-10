import { sendEmail } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/admin';

type UserRole = 'homeowner' | 'contractor';

type NotifyResult = {
  sent: number;
  skipped: number;
};

type ProjectRow = {
  id: string;
  title: string;
  homeowner_id: string;
  status?: string | null;
  awarded_offer_id?: string | null;
};

type OfferRow = {
  id: string;
  project_id: string;
  sender_id: string;
  sender_role: UserRole;
  recipient_id?: string | null;
  recipient_role?: UserRole | null;
  amount: number | string | null;
  timeline_days?: number | null;
  kind?: string | null;
};

type ConversationRow = {
  id: string;
  project_id: string;
  homeowner_id: string;
  contractor_id: string;
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function notifyOfferCreated(offerId: string) {
  return quietly(async () => {
    const db = createAdminClient();
    const offer = await getOffer(db, offerId);
    if (!offer) return emptyResult();

    const project = await getProject(db, offer.project_id);
    if (!project) return emptyResult();

    const recipientId = offer.recipient_id || project.homeowner_id;
    const senderName = await displayNameForUser(db, offer.sender_id);
    const subject =
      offer.sender_role === 'contractor'
        ? `New contractor offer: ${project.title}`
        : `New budget offer: ${project.title}`;

    return sendToUsers(db, [recipientId], {
      subject,
      text: [
        `${senderName} sent a new offer on "${project.title}".`,
        '',
        `Amount: ${money(offer.amount)}`,
        offer.timeline_days ? `Timeline: ${offer.timeline_days} days` : null,
        '',
        `Open it here: ${projectUrlForRole(offer.recipient_role ?? 'homeowner', project.id)}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  });
}

export async function notifyOfferAccepted(offerId: string) {
  return quietly(async () => {
    const db = createAdminClient();
    const offer = await getOffer(db, offerId);
    if (!offer) return emptyResult();

    const project = await getProject(db, offer.project_id);
    if (!project) return emptyResult();

    return sendToUsers(db, [offer.sender_id], {
      subject: `Offer accepted: ${project.title}`,
      text: [
        `Your offer on "${project.title}" was accepted.`,
        '',
        `Amount: ${money(offer.amount)}`,
        'The homeowner still needs to complete checkout before the job is booked.',
        '',
        `Open the deal: ${projectUrlForRole(offer.sender_role, project.id)}`,
      ].join('\n'),
    });
  });
}

export async function notifyOfferDeclined(offerId: string) {
  return quietly(async () => {
    const db = createAdminClient();
    const offer = await getOffer(db, offerId);
    if (!offer) return emptyResult();

    const project = await getProject(db, offer.project_id);
    if (!project) return emptyResult();

    return sendToUsers(db, [offer.sender_id], {
      subject: `Offer declined: ${project.title}`,
      text: [
        `Your offer on "${project.title}" was declined.`,
        '',
        `Open the project: ${projectUrlForRole(offer.sender_role, project.id)}`,
      ].join('\n'),
    });
  });
}

export async function notifyMessageCreated(messageId: string) {
  return quietly(async () => {
    const db = createAdminClient();
    const { data: message } = await db
      .from('messages')
      .select('id, conversation_id, sender_id, content, kind')
      .eq('id', messageId)
      .maybeSingle();
    if (!message || message.kind === 'system') return emptyResult();

    const conversation = await getConversation(db, message.conversation_id);
    if (!conversation) return emptyResult();

    const recipientId =
      message.sender_id === conversation.homeowner_id
        ? conversation.contractor_id
        : conversation.homeowner_id;
    const project = await getProject(db, conversation.project_id);
    const senderName = await displayNameForUser(db, message.sender_id);

    return sendToUsers(db, [recipientId], {
      subject: `New message${project ? `: ${project.title}` : ''}`,
      text: [
        `${senderName} sent you a message${project ? ` about "${project.title}"` : ''}.`,
        '',
        preview(message.content),
        '',
        `Reply here: ${conversationUrl(
          conversation.project_id,
          message.sender_id,
        )}`,
      ].join('\n'),
    });
  });
}

export async function notifyCheckoutCompleted(projectId: string) {
  return quietly(async () => {
    const db = createAdminClient();
    const project = await getProject(db, projectId);
    if (!project?.awarded_offer_id) return emptyResult();

    const offer = await getOffer(db, project.awarded_offer_id);
    if (!offer) return emptyResult();

    return sendToUsers(db, [offer.sender_id], {
      subject: `Checkout completed: ${project.title}`,
      text: [
        `The homeowner completed checkout for "${project.title}".`,
        '',
        'Your contractor commitment fee is now due. Pay it to activate the job and unlock direct chat.',
        '',
        `Continue here: ${APP_URL}/dashboard/contractor/jobs/${project.id}/commit`,
      ].join('\n'),
    });
  });
}

export async function notifyContractorCommitted(projectId: string) {
  return quietly(async () => {
    const db = createAdminClient();
    const project = await getProject(db, projectId);
    if (!project) return emptyResult();

    return sendToUsers(db, [project.homeowner_id], {
      subject: `Job started: ${project.title}`,
      text: [
        `The contractor commitment is complete for "${project.title}".`,
        '',
        'The job is now active and direct chat is unlocked.',
        '',
        `Open the project: ${projectUrlForRole('homeowner', project.id)}`,
      ].join('\n'),
    });
  });
}

export async function notifyProjectCompleted(projectId: string) {
  return quietly(async () => {
    const db = createAdminClient();
    const project = await getProject(db, projectId);
    if (!project?.awarded_offer_id) return emptyResult();

    const offer = await getOffer(db, project.awarded_offer_id);
    if (!offer) return emptyResult();

    return sendToUsers(db, [offer.sender_id], {
      subject: `Project completed: ${project.title}`,
      text: [
        `The homeowner marked "${project.title}" as complete.`,
        '',
        'Escrow has been released in bidAI. You can review earnings from your contractor dashboard.',
        '',
        `Open earnings: ${APP_URL}/dashboard/contractor/earnings`,
      ].join('\n'),
    });
  });
}

export async function notifySupportReportCreated(reportId: string) {
  return quietly(async () => {
    const adminEmails = configuredAdminEmails();
    if (adminEmails.length === 0) return emptyResult();

    const db = createAdminClient();
    const { data: report } = await db
      .from('support_reports')
      .select('id, reporter_id, category, subject, message')
      .eq('id', reportId)
      .maybeSingle();
    if (!report) return emptyResult();

    const reporterName = await displayNameForUser(db, report.reporter_id);

    return sendRaw(adminEmails, {
      subject: `Support report: ${report.subject}`,
      text: [
        `${reporterName} filed a support report.`,
        '',
        `Category: ${report.category}`,
        `Subject: ${report.subject}`,
        '',
        report.message,
        '',
        `Open admin support: ${APP_URL}/admin/support`,
      ].join('\n'),
    });
  });
}

export async function notifyDisputeRaised(disputeId: string) {
  return quietly(async () => {
    const db = createAdminClient();
    const { data: dispute } = await db
      .from('disputes')
      .select('id, project_id, raised_by, reason')
      .eq('id', disputeId)
      .maybeSingle();
    if (!dispute) return emptyResult();

    const project = await getProject(db, dispute.project_id);
    if (!project) return emptyResult();

    const offer = project.awarded_offer_id
      ? await getOffer(db, project.awarded_offer_id)
      : null;
    const participantIds = [project.homeowner_id, offer?.sender_id].filter(
      (id): id is string => Boolean(id && id !== dispute.raised_by),
    );
    const adminEmails = configuredAdminEmails();

    const participantResult = await sendToUsers(db, participantIds, {
      subject: `Dispute opened: ${project.title}`,
      text: [
        `A dispute was opened for "${project.title}".`,
        '',
        `Reason: ${dispute.reason}`,
        '',
        `Open the project: ${projectUrlForRole('homeowner', project.id)}`,
      ].join('\n'),
    });

    const adminResult = await sendRaw(adminEmails, {
      subject: `Dispute opened: ${project.title}`,
      text: [
        `A dispute was opened for "${project.title}".`,
        '',
        `Reason: ${dispute.reason}`,
        '',
        `Open admin disputes: ${APP_URL}/admin/disputes`,
      ].join('\n'),
    });

    return {
      sent: participantResult.sent + adminResult.sent,
      skipped: participantResult.skipped + adminResult.skipped,
    };
  });
}

export async function notifySupportReportResolved(reportId: string) {
  return quietly(async () => {
    const db = createAdminClient();
    const { data: report } = await db
      .from('support_reports')
      .select('id, reporter_id, subject, admin_note')
      .eq('id', reportId)
      .maybeSingle();
    if (!report) return emptyResult();

    return sendToUsers(db, [report.reporter_id], {
      subject: `Support update: ${report.subject}`,
      text: [
        `Your support report "${report.subject}" was resolved.`,
        report.admin_note ? `\nTeam note:\n${report.admin_note}` : null,
        '',
        `Open support: ${APP_URL}/dashboard/support`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  });
}

export async function notifyDisputeResolved(disputeId: string) {
  return quietly(async () => {
    const db = createAdminClient();
    const { data: dispute } = await db
      .from('disputes')
      .select('id, project_id, resolution, admin_note')
      .eq('id', disputeId)
      .maybeSingle();
    if (!dispute) return emptyResult();

    const project = await getProject(db, dispute.project_id);
    if (!project) return emptyResult();

    const offer = project.awarded_offer_id
      ? await getOffer(db, project.awarded_offer_id)
      : null;
    const participantIds = [project.homeowner_id, offer?.sender_id].filter(
      (id): id is string => Boolean(id),
    );

    return sendToUsers(db, participantIds, {
      subject: `Dispute resolved: ${project.title}`,
      text: [
        `The dispute for "${project.title}" was resolved.`,
        '',
        `Resolution: ${dispute.resolution ?? 'resolved'}`,
        dispute.admin_note ? `\nTeam note:\n${dispute.admin_note}` : null,
        '',
        `Open bidAI: ${APP_URL}/dashboard`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  });
}

async function sendToUsers(
  db: ReturnType<typeof createAdminClient>,
  userIds: string[],
  message: { subject: string; text: string },
): Promise<NotifyResult> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  let sent = 0;
  let skipped = 0;

  for (const userId of uniqueIds) {
    const email = await emailForUser(db, userId);
    if (!email) {
      skipped += 1;
      continue;
    }

    const result = await sendEmail({ to: email, ...message });
    if (result.skipped) skipped += 1;
    else sent += 1;
  }

  return { sent, skipped };
}

async function sendRaw(
  emails: string[],
  message: { subject: string; text: string },
): Promise<NotifyResult> {
  const uniqueEmails = [...new Set(emails.filter(Boolean))];
  if (uniqueEmails.length === 0) return emptyResult();

  const result = await sendEmail({ to: uniqueEmails, ...message });
  return result.skipped
    ? { sent: 0, skipped: uniqueEmails.length }
    : { sent: uniqueEmails.length, skipped: 0 };
}

async function getProject(
  db: ReturnType<typeof createAdminClient>,
  projectId: string,
) {
  const { data } = await db
    .from('projects')
    .select('id, title, homeowner_id, status, awarded_offer_id')
    .eq('id', projectId)
    .maybeSingle();
  return data as ProjectRow | null;
}

async function getOffer(db: ReturnType<typeof createAdminClient>, offerId: string) {
  const { data } = await db
    .from('offers')
    .select(
      'id, project_id, sender_id, sender_role, recipient_id, recipient_role, amount, timeline_days, kind',
    )
    .eq('id', offerId)
    .maybeSingle();
  return data as OfferRow | null;
}

async function getConversation(
  db: ReturnType<typeof createAdminClient>,
  conversationId: string,
) {
  const { data } = await db
    .from('conversations')
    .select('id, project_id, homeowner_id, contractor_id')
    .eq('id', conversationId)
    .maybeSingle();
  return data as ConversationRow | null;
}

async function emailForUser(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error) {
    console.error('Notification user lookup failed:', error.message);
    return null;
  }
  return data.user?.email ?? null;
}

async function displayNameForUser(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { data } = await db
    .from('profiles')
    .select('full_name, role')
    .eq('id', userId)
    .maybeSingle();
  return data?.full_name || (data?.role === 'contractor' ? 'A contractor' : 'A homeowner');
}

function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function preview(value: string) {
  return value.length > 240 ? `${value.slice(0, 237)}...` : value;
}

function projectUrlForRole(role: UserRole, projectId: string) {
  const section = role === 'contractor' ? 'contractor' : 'homeowner';
  return `${APP_URL}/dashboard/${section}/projects/${projectId}`;
}

function conversationUrl(projectId: string, partnerId: string) {
  return `${APP_URL}/dashboard/messages/${projectId}/${partnerId}`;
}

function emptyResult(): NotifyResult {
  return { sent: 0, skipped: 0 };
}

async function quietly(fn: () => Promise<NotifyResult>) {
  try {
    return await fn();
  } catch (error) {
    console.error('Notification failed:', error);
    return emptyResult();
  }
}

/**
 * Notify the reporter that the bidAI support team replied on their case.
 */
export async function notifySupportReplyFromAdmin(messageId: string) {
  return quietly(async () => {
    const db = createAdminClient();

    const { data: message } = await db
      .from('support_messages')
      .select('id, report_id, body, sender_role')
      .eq('id', messageId)
      .maybeSingle();
    if (!message || message.sender_role !== 'admin') return emptyResult();

    const { data: report } = await db
      .from('support_reports')
      .select('id, reporter_id, subject')
      .eq('id', message.report_id)
      .maybeSingle();
    if (!report) return emptyResult();

    return sendToUsers(db, [report.reporter_id], {
      subject: `Update on your support case: ${report.subject}`,
      text: [
        `The bidAI support team replied on "${report.subject}".`,
        '',
        preview(message.body),
        '',
        `Open the case: ${APP_URL}/dashboard/support/${report.id}`,
      ].join('\n'),
    });
  });
}

/**
 * Notify the bidAI support inbox that a reporter added a new message
 * (either follow-up details or a reply to an admin response).
 */
export async function notifySupportReplyFromReporter(messageId: string) {
  return quietly(async () => {
    const adminEmails = configuredAdminEmails();
    if (adminEmails.length === 0) return emptyResult();

    const db = createAdminClient();

    const { data: message } = await db
      .from('support_messages')
      .select('id, report_id, body, sender_id, sender_role')
      .eq('id', messageId)
      .maybeSingle();
    if (!message || message.sender_role !== 'reporter') return emptyResult();

    const { data: report } = await db
      .from('support_reports')
      .select('id, subject')
      .eq('id', message.report_id)
      .maybeSingle();
    if (!report) return emptyResult();

    const reporterName = await displayNameForUser(db, message.sender_id);

    return sendRaw(adminEmails, {
      subject: `Reporter replied on support case: ${report.subject}`,
      text: [
        `${reporterName} added a new message on "${report.subject}".`,
        '',
        preview(message.body),
        '',
        `Open admin support: ${APP_URL}/admin/support/${report.id}`,
      ].join('\n'),
    });
  });
}
