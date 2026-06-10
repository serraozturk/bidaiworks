'use server';

import { revalidatePath } from 'next/cache';
import { getAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  notifyDisputeResolved,
  notifySupportReplyFromAdmin,
  notifySupportReportResolved,
} from '@/lib/notifications';

/** Every admin action re-checks the email allowlist before mutating. */
async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error('Not authorized.');
  return admin;
}

async function logAdminEvent({
  adminId,
  projectId,
  eventType,
  summary,
  detail,
}: {
  adminId: string;
  projectId?: string | null;
  eventType: string;
  summary: string;
  detail?: Record<string, unknown>;
}) {
  const db = createAdminClient();
  await db.from('marketplace_events').insert({
    project_id: projectId ?? null,
    actor_id: adminId,
    actor_role: 'admin',
    event_type: eventType,
    summary,
    detail: detail ?? {},
  });
}

export async function approveProject(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const db = createAdminClient();
  await db
    .from('projects')
    .update({
      moderation_status: 'approved',
      moderation_note: null,
      moderated_at: new Date().toISOString(),
      moderated_by: admin.id,
    })
    .eq('id', id);
  await logAdminEvent({
    adminId: admin.id,
    projectId: id,
    eventType: 'admin_project_approved',
    summary: 'Admin approved project for contractor visibility',
  });
  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${id}`);
  revalidatePath('/admin');
}

export async function rejectProject(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const note =
    String(formData.get('note') ?? '').trim() ||
    'This project was not approved during review.';
  const db = createAdminClient();
  await db
    .from('projects')
    .update({
      moderation_status: 'rejected',
      moderation_note: note,
      moderated_at: new Date().toISOString(),
      moderated_by: admin.id,
    })
    .eq('id', id);
  await logAdminEvent({
    adminId: admin.id,
    projectId: id,
    eventType: 'admin_project_rejected',
    summary: 'Admin rejected project during review',
    detail: { note },
  });
  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${id}`);
  revalidatePath('/admin');
}

export async function setContractorVerified(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const verified = String(formData.get('verified') ?? '') === 'true';
  const db = createAdminClient();
  await db
    .from('contractor_profiles')
    .update({
      verified,
      verification_status: verified ? 'verified' : 'pending_verification',
      verified_at: verified ? new Date().toISOString() : null,
      verified_by: verified ? admin.id : null,
      rejection_reason: null,
    })
    .eq('user_id', id);
  await logAdminEvent({
    adminId: admin.id,
    eventType: verified ? 'admin_contractor_verified' : 'admin_contractor_unverified',
    summary: verified
      ? 'Admin verified contractor profile'
      : 'Admin removed contractor verification',
    detail: { contractor_id: id },
  });
  revalidatePath('/admin/contractors');
  revalidatePath(`/admin/contractors/${id}`);
  revalidatePath('/admin/operations');
}

export async function rejectContractor(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim() || 'Application did not meet requirements.';
  const status = (String(formData.get('status') ?? 'rejected').trim()) as 'rejected' | 'suspended';
  if (!id) return;
  const db = createAdminClient();
  await db
    .from('contractor_profiles')
    .update({
      verified: false,
      verification_status: status,
      rejection_reason: reason,
    })
    .eq('user_id', id);
  await logAdminEvent({
    adminId: admin.id,
    eventType: `admin_contractor_${status}`,
    summary: `Admin ${status} contractor`,
    detail: { contractor_id: id, reason },
  });
  revalidatePath('/admin/contractors');
  revalidatePath(`/admin/contractors/${id}`);
}

export async function setUserSuspended(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const suspended = String(formData.get('suspended') ?? '') === 'true';
  const reason = String(formData.get('reason') ?? '').trim() || null;
  const db = createAdminClient();
  await db
    .from('profiles')
    .update({
      suspended,
      suspended_at: suspended ? new Date().toISOString() : null,
      suspension_reason: suspended ? reason : null,
    })
    .eq('id', id);
  await logAdminEvent({
    adminId: admin.id,
    eventType: suspended ? 'admin_user_suspended' : 'admin_user_unsuspended',
    summary: suspended ? 'Admin suspended user account' : 'Admin restored user account',
    detail: { user_id: id, reason },
  });
  revalidatePath('/admin/contractors');
  revalidatePath(`/admin/contractors/${id}`);
  revalidatePath('/admin/operations');
}

export async function resolveSupportReport(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get('id') ?? '').trim();

  if (!id) return;

  const note =
    String(formData.get('note') ?? '').trim() ||
    'Your support case has been reviewed and resolved by bidAI support.';

  const db = createAdminClient();
  const now = new Date().toISOString();

  await db
    .from('support_reports')
    .update({
      status: 'resolved',
      admin_note: note,
      resolved_at: now,
      last_admin_response_at: now,
    })
    .eq('id', id);

  await notifySupportReportResolved(id);

  revalidatePath('/admin/support');
  revalidatePath(`/admin/support/${id}`);
  revalidatePath('/dashboard/support');
  revalidatePath(`/dashboard/support/${id}`);
  revalidatePath('/admin');
}

/**
 * Resolve a dispute. `resolution` is released | refunded | dismissed.
 * released  -> escrow released to the contractor, project completed.
 * refunded  -> escrow refunded to the homeowner, project cancelled.
 * dismissed -> dispute closed, the job continues unchanged.
 */
export async function resolveDispute(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const resolution = String(formData.get('resolution') ?? '').trim();
  if (!id || !['released', 'refunded', 'dismissed'].includes(resolution)) return;
  const note = String(formData.get('note') ?? '').trim() || null;
  const db = createAdminClient();

  const { data: dispute } = await db
    .from('disputes')
    .select('id, project_id, status')
    .eq('id', id)
    .maybeSingle();
  if (!dispute || dispute.status === 'resolved') return;

  const now = new Date().toISOString();
  await db
    .from('disputes')
    .update({
      status: 'resolved',
      resolution,
      admin_note: note,
      resolved_at: now,
      last_admin_response_at: now,
    })
    .eq('id', id);

  if (resolution === 'released') {
    await db
      .from('payments')
      .update({ status: 'released', released_at: now })
      .eq('project_id', dispute.project_id)
      .eq('status', 'held');
    await db
      .from('projects')
      .update({ status: 'completed', payment_status: 'released', completed_at: now })
      .eq('id', dispute.project_id);
  } else if (resolution === 'refunded') {
    await db
      .from('payments')
      .update({ status: 'refunded', refunded_at: now })
      .eq('project_id', dispute.project_id)
      .eq('status', 'held');
    await db
      .from('projects')
      .update({ status: 'cancelled', payment_status: 'refunded', cancelled_at: now })
      .eq('id', dispute.project_id);
  }

  await notifyDisputeResolved(id);
  await logAdminEvent({
    adminId: admin.id,
    projectId: dispute.project_id,
    eventType: 'admin_dispute_resolved',
    summary: `Admin resolved dispute: ${resolution}`,
    detail: { dispute_id: id, resolution, note },
  });

  revalidatePath('/admin/disputes');
  revalidatePath(`/admin/projects/${dispute.project_id}`);
  revalidatePath('/admin/payments');
  revalidatePath('/admin/operations');
  revalidatePath('/admin');
}

export async function releaseProjectEscrow(formData: FormData) {
  const admin = await requireAdmin();
  const projectId = String(formData.get('projectId') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim() || null;
  if (!projectId) return;

  const db = createAdminClient();
  const now = new Date().toISOString();
  await db
    .from('payments')
    .update({ status: 'released', released_at: now })
    .eq('project_id', projectId)
    .eq('status', 'held');
  await db
    .from('projects')
    .update({ status: 'completed', payment_status: 'released', completed_at: now })
    .eq('id', projectId);
  await logAdminEvent({
    adminId: admin.id,
    projectId,
    eventType: 'admin_escrow_released',
    summary: 'Admin manually released escrow to contractor',
    detail: { note },
  });

  revalidatePath('/admin/payments');
  revalidatePath('/admin/operations');
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath('/admin');
}

export async function refundProjectEscrow(formData: FormData) {
  const admin = await requireAdmin();
  const projectId = String(formData.get('projectId') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim() || null;
  if (!projectId) return;

  const db = createAdminClient();
  const now = new Date().toISOString();
  await db
    .from('payments')
    .update({ status: 'refunded', refunded_at: now })
    .eq('project_id', projectId)
    .eq('status', 'held');
  await db
    .from('projects')
    .update({
      status: 'cancelled',
      payment_status: 'refunded',
      contractor_fee_status: 'none',
      contractor_commit_due_at: null,
      cancelled_at: now,
    })
    .eq('id', projectId);
  await logAdminEvent({
    adminId: admin.id,
    projectId,
    eventType: 'admin_escrow_refunded',
    summary: 'Admin manually refunded escrow to homeowner',
    detail: { note },
  });

  revalidatePath('/admin/payments');
  revalidatePath('/admin/operations');
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath('/admin');
}

export async function upsertCategory(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const slug = toKey(String(formData.get('slug') ?? name));
  if (!name || !slug) return;

  const db = createAdminClient();
  const payload = {
    name,
    slug,
    description: String(formData.get('description') ?? '').trim() || null,
    icon: String(formData.get('icon') ?? '').trim() || null,
    sort_order: Number(formData.get('sort_order') ?? 0) || 0,
    active: boolValue(formData, 'active', true),
    commission_rate: numberOrNull(formData.get('commission_rate')),
  };

  if (id) {
    await db.from('categories').update(payload).eq('id', id);
  } else {
    await db.from('categories').insert(payload);
  }

  await logAdminEvent({
    adminId: admin.id,
    eventType: id ? 'admin_category_updated' : 'admin_category_created',
    summary: id ? `Admin updated category ${name}` : `Admin created category ${name}`,
    detail: { category_id: id || null, slug },
  });
  revalidatePath('/admin/categories');
  revalidatePath('/dashboard/homeowner/new');
  revalidatePath('/');
}

export async function addCategoryQuestion(formData: FormData) {
  const admin = await requireAdmin();
  const categoryId = String(formData.get('category_id') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  if (!categoryId || !label) return;

  const questionKey = toKey(String(formData.get('question_key') ?? label));
  const db = createAdminClient();
  await db.from('category_brief_questions').upsert(
    {
      category_id: categoryId,
      question_key: questionKey,
      label,
      type: String(formData.get('type') ?? 'text'),
      required: boolValue(formData, 'required', true),
      options: lines(formData.get('options')),
      help_text: String(formData.get('help_text') ?? '').trim() || null,
      sort_order: Number(formData.get('sort_order') ?? 0) || 0,
      is_active: true,
    },
    { onConflict: 'category_id,question_key' },
  );
  await logAdminEvent({
    adminId: admin.id,
    eventType: 'admin_category_question_saved',
    summary: `Admin saved intake question: ${label}`,
    detail: { category_id: categoryId, question_key: questionKey },
  });
  revalidatePath('/admin/categories');
  revalidatePath('/dashboard/homeowner/new');
}

export async function addCategoryPhotoRequirement(formData: FormData) {
  const admin = await requireAdmin();
  const categoryId = String(formData.get('category_id') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  if (!categoryId || !label) return;

  const photoKey = toKey(String(formData.get('photo_key') ?? label));
  const db = createAdminClient();
  await db.from('category_photo_requirements').upsert(
    {
      category_id: categoryId,
      photo_key: photoKey,
      label,
      description: String(formData.get('description') ?? '').trim() || null,
      required: boolValue(formData, 'required', true),
      sort_order: Number(formData.get('sort_order') ?? 0) || 0,
      is_active: true,
    },
    { onConflict: 'category_id,photo_key' },
  );
  await logAdminEvent({
    adminId: admin.id,
    eventType: 'admin_category_photo_saved',
    summary: `Admin saved photo requirement: ${label}`,
    detail: { category_id: categoryId, photo_key: photoKey },
  });
  revalidatePath('/admin/categories');
  revalidatePath('/dashboard/homeowner/new');
}

export async function addCategoryMaterialField(formData: FormData) {
  const admin = await requireAdmin();
  const categoryId = String(formData.get('category_id') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  if (!categoryId || !label) return;

  const itemKey = toKey(String(formData.get('item_key') ?? label));
  const db = createAdminClient();
  await db.from('category_material_fields').upsert(
    {
      category_id: categoryId,
      item_key: itemKey,
      label,
      options: lines(formData.get('options')),
      quality_levels: lines(formData.get('quality_levels')).length
        ? lines(formData.get('quality_levels'))
        : ['Budget', 'Standard', 'Premium', 'Luxury'],
      allow_custom: boolValue(formData, 'allow_custom', true),
      sort_order: Number(formData.get('sort_order') ?? 0) || 0,
      is_active: true,
    },
    { onConflict: 'category_id,item_key' },
  );
  await logAdminEvent({
    adminId: admin.id,
    eventType: 'admin_category_material_saved',
    summary: `Admin saved material field: ${label}`,
    detail: { category_id: categoryId, item_key: itemKey },
  });
  revalidatePath('/admin/categories');
  revalidatePath('/dashboard/homeowner/new');
}

export async function deactivateCategoryBriefItem(formData: FormData) {
  const admin = await requireAdmin();
  const table = String(formData.get('table') ?? '');
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const allowed = [
    'category_brief_questions',
    'category_photo_requirements',
    'category_material_fields',
  ];
  if (!allowed.includes(table)) return;

  const db = createAdminClient();
  await db.from(table).update({ is_active: false }).eq('id', id);
  await logAdminEvent({
    adminId: admin.id,
    eventType: 'admin_category_brief_item_deactivated',
    summary: `Admin deactivated ${table} item`,
    detail: { table, id },
  });
  revalidatePath('/admin/categories');
  revalidatePath('/dashboard/homeowner/new');
}

/**
 * Admin posts a reply on a support case without resolving it. Used for
 * back-and-forth investigation (asking for more info, sending updates).
 */
export async function replySupportFromAdmin(formData: FormData) {
  const admin = await requireAdmin();
  const reportId = String(formData.get('id') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!reportId || !body) return;

  const db = createAdminClient();

  const { data: message, error: insertError } = await db
    .from('support_messages')
    .insert({
      report_id: reportId,
      sender_id: admin.id,
      sender_role: 'admin',
      body,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Admin reply support error:', insertError);
    return;
  }

  // Ball is now in reporter's court (unless the case is already resolved).
  await db
    .from('support_reports')
    .update({
      status: 'awaiting_reporter',
      last_admin_response_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .neq('status', 'resolved');

  if (message?.id) {
    await notifySupportReplyFromAdmin(message.id);
  }

  await logAdminEvent({
    adminId: admin.id,
    eventType: 'admin_support_replied',
    summary: 'Admin replied on a support case',
    detail: { report_id: reportId },
  });

  revalidatePath(`/admin/support/${reportId}`);
  revalidatePath('/admin/support');
}

/* ---------- Deep moderation ---------- */

/** Hide an individual message without deleting it. The original text is
 *  preserved in `original_content` for admin reference; `content` is
 *  replaced with a fixed placeholder so every existing client UI shows
 *  the redaction without needing UI changes. */
export async function redactMessage(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  const reason =
    String(formData.get('reason') ?? '').trim() ||
    'Removed by bidAI support for policy violation.';
  if (!id) return;

  const db = createAdminClient();

  // Back up the live content if this is the first redaction.
  const { data: existing } = await db
    .from('messages')
    .select('content, original_content')
    .eq('id', id)
    .maybeSingle();
  const backup = existing?.original_content ?? existing?.content ?? null;

  await db
    .from('messages')
    .update({
      redacted_at: new Date().toISOString(),
      redacted_by: admin.id,
      redacted_reason: reason,
      original_content: backup,
      content:
        '⚠️ This message was removed by bidAI support for a policy violation.',
    })
    .eq('id', id);

  await logAdminEvent({
    adminId: admin.id,
    eventType: 'admin_message_redacted',
    summary: 'Admin redacted a message',
    detail: { message_id: id, reason },
  });

  if (conversationId) {
    revalidatePath(`/admin/conversations/${conversationId}`);
    revalidatePath(`/dashboard/messages/${conversationId}`);
  }
  revalidatePath('/admin/flags');
}

/** Restore a previously redacted message (rarely used). */
export async function unredactMessage(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const conversationId = String(formData.get('conversationId') ?? '').trim();
  if (!id) return;

  const db = createAdminClient();

  const { data: existing } = await db
    .from('messages')
    .select('original_content')
    .eq('id', id)
    .maybeSingle();

  await db
    .from('messages')
    .update({
      redacted_at: null,
      redacted_by: null,
      redacted_reason: null,
      content:
        existing?.original_content ??
        '[Message restored — original text was not recoverable.]',
      original_content: null,
    })
    .eq('id', id);

  await logAdminEvent({
    adminId: admin.id,
    eventType: 'admin_message_unredacted',
    summary: 'Admin restored a previously redacted message',
    detail: { message_id: id },
  });

  if (conversationId) {
    revalidatePath(`/admin/conversations/${conversationId}`);
  }
}

/** Freeze a conversation so neither party can send new messages. */
export async function lockConversation(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const reason =
    String(formData.get('reason') ?? '').trim() ||
    'Locked by bidAI support pending review.';
  if (!id) return;

  const db = createAdminClient();
  await db
    .from('conversations')
    .update({
      locked_at: new Date().toISOString(),
      locked_by: admin.id,
      locked_reason: reason,
    })
    .eq('id', id);

  await logAdminEvent({
    adminId: admin.id,
    eventType: 'admin_conversation_locked',
    summary: 'Admin locked a deal-room conversation',
    detail: { conversation_id: id, reason },
  });

  revalidatePath(`/admin/conversations/${id}`);
  revalidatePath('/admin/conversations');
}

/** Unlock a previously locked conversation. */
export async function unlockConversation(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const db = createAdminClient();
  await db
    .from('conversations')
    .update({ locked_at: null, locked_by: null, locked_reason: null })
    .eq('id', id);

  await logAdminEvent({
    adminId: admin.id,
    eventType: 'admin_conversation_unlocked',
    summary: 'Admin unlocked a deal-room conversation',
    detail: { conversation_id: id },
  });

  revalidatePath(`/admin/conversations/${id}`);
}

/**
 * Mute or unmute a user's messaging ability. Lighter than a full suspend:
 * the user can still browse and act on the platform but cannot send
 * messages in any deal room. Enforced via the messages-insert trigger.
 */
export async function setUserMessagingDisabled(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const disabled = String(formData.get('disabled') ?? '') === 'true';
  const reason = String(formData.get('reason') ?? '').trim() || null;

  const db = createAdminClient();
  await db
    .from('profiles')
    .update({
      messaging_disabled: disabled,
      messaging_disabled_at: disabled ? new Date().toISOString() : null,
      messaging_disabled_reason: disabled ? reason : null,
    })
    .eq('id', id);

  await logAdminEvent({
    adminId: admin.id,
    eventType: disabled ? 'admin_user_muted' : 'admin_user_unmuted',
    summary: disabled
      ? 'Admin muted a user (messaging blocked)'
      : 'Admin unmuted a user (messaging restored)',
    detail: { user_id: id, reason },
  });

  revalidatePath(`/admin/contractors/${id}`);
  revalidatePath('/admin/contractors');
  revalidatePath('/admin/flags');
}

/** Manually open an admin_flags case (used from inside reviews / cases). */
export async function createFlag(formData: FormData) {
  const admin = await requireAdmin();
  const kind = String(formData.get('kind') ?? 'other').trim();
  const summary = String(formData.get('summary') ?? '').trim() || 'Admin-opened flag';
  const severity = String(formData.get('severity') ?? 'normal').trim() || 'normal';
  const projectId = String(formData.get('projectId') ?? '').trim() || null;
  const offerId = String(formData.get('offerId') ?? '').trim() || null;
  const messageId = String(formData.get('messageId') ?? '').trim() || null;
  const userId = String(formData.get('userId') ?? '').trim() || null;
  const note = String(formData.get('note') ?? '').trim() || null;

  const db = createAdminClient();
  await db.from('admin_flags').insert({
    kind,
    severity,
    status: 'open',
    project_id: projectId,
    offer_id: offerId,
    message_id: messageId,
    user_id: userId,
    summary,
    detail: note ? { note } : null,
  });

  await logAdminEvent({
    adminId: admin.id,
    eventType: 'admin_flag_created',
    summary,
    detail: { kind, severity, project_id: projectId, offer_id: offerId, user_id: userId },
  });

  revalidatePath('/admin/flags');
}

/** Close a flag without taking platform action ("looked at — nothing to do"). */
export async function dismissFlag(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim() || null;
  if (!id) return;

  const db = createAdminClient();
  await db
    .from('admin_flags')
    .update({
      status: 'dismissed',
      handled_by: admin.id,
      admin_note: note,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id);

  await logAdminEvent({
    adminId: admin.id,
    eventType: 'admin_flag_dismissed',
    summary: 'Admin dismissed a flag',
    detail: { flag_id: id, note },
  });

  revalidatePath('/admin/flags');
}

/** Close a flag and mark that platform action was taken (suspended, redacted, etc.). */
export async function actionFlag(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim() || null;
  if (!id) return;

  const db = createAdminClient();
  await db
    .from('admin_flags')
    .update({
      status: 'actioned',
      handled_by: admin.id,
      admin_note: note,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id);

  await logAdminEvent({
    adminId: admin.id,
    eventType: 'admin_flag_actioned',
    summary: 'Admin actioned and closed a flag',
    detail: { flag_id: id, note },
  });

  revalidatePath('/admin/flags');
}

function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const clean = String(value ?? '').trim();
  if (!clean) return null;
  const number = Number(clean);
  return Number.isFinite(number) ? number : null;
}

function boolValue(formData: FormData, key: string, fallback: boolean): boolean {
  const values = formData.getAll(key);
  if (values.length === 0) return fallback;
  return String(values[values.length - 1]) === 'true';
}

function toKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
