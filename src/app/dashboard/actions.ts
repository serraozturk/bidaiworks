'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  notifyDisputeRaised,
  notifySupportReplyFromReporter,
  notifySupportReportCreated,
} from '@/lib/notifications';

/**
 * Homeowner / contractor submits a "report a problem" / support request.
 * RLS guarantees a user can only file under their own id.
 */
export async function submitSupportReport(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const subject = String(formData.get('subject') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();

  if (!subject || !message) {
    redirect('/dashboard/support?error=missing');
  }

  const category = String(formData.get('category') ?? 'other').trim();
  const priority = String(formData.get('priority') ?? 'normal').trim();
  const projectId = String(formData.get('projectId') ?? '').trim();
  const requestedOutcome = String(
    formData.get('requestedOutcome') ?? '',
  ).trim();
  const contactPreference = String(
    formData.get('contactPreference') ?? 'in_app',
  ).trim();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const reporterRole = profile?.role ?? 'homeowner';

  const headerStore = headers();
  const pageUrl = headerStore.get('referer') ?? null;

  const { data: report, error } = await supabase
    .from('support_reports')
    .insert({
      reporter_id: user.id,
      reporter_role: reporterRole,
      project_id: projectId || null,
      category,
      subject,
      message,
      status: 'awaiting_admin',
      priority,
      requested_outcome: requestedOutcome || null,
      contact_preference: contactPreference || null,
      page_url: pageUrl,
      last_user_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Submit support report error:', error);
    redirect('/dashboard/support?error=failed');
  }

  if (report?.id) {
    await notifySupportReportCreated(report.id);
  }

  redirect('/dashboard/support?sent=1');
}

/**
 * Homeowner or contractor adds a follow-up message to one of their own
 * support cases (asks a question, replies to admin, adds more context).
 * RLS guarantees the user can only post under their own report and only
 * while it is still open.
 */
export async function replySupportFromUser(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const reportId = String(formData.get('reportId') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!reportId) redirect('/dashboard/support');
  if (!body) redirect(`/dashboard/support/${reportId}?error=missing`);

  const { data: message, error: insertError } = await supabase
    .from('support_messages')
    .insert({
      report_id: reportId,
      sender_id: user.id,
      sender_role: 'reporter',
      body,
    })
    .select('id')
    .single();

  if (insertError || !message?.id) {
    console.error('Reply support report error:', insertError);
    redirect(`/dashboard/support/${reportId}?error=send`);
  }

  // Ball is back in admin's court.
  await supabase
    .from('support_reports')
    .update({
      status: 'awaiting_admin',
      last_user_message_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .eq('reporter_id', user.id)
    .neq('status', 'resolved');

  await notifySupportReplyFromReporter(message.id);

  redirect(`/dashboard/support/${reportId}?sent=1`);
}

/**
 * Homeowner or the awarded contractor raises a dispute on a project.
 * RLS ('disputes participant insert') guarantees only a real participant
 * can file one.
 */
export async function raiseDispute(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const projectId = String(formData.get('projectId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  // Validate backTo is an internal relative path to prevent open redirect.
  const rawBackTo = String(formData.get('backTo') ?? '').trim();
  const backTo =
    rawBackTo.startsWith('/') && !rawBackTo.startsWith('//')
      ? rawBackTo
      : '/dashboard';
  const category = String(formData.get('category') ?? 'work_quality').trim() || 'work_quality';
  const requestedResolution =
    String(formData.get('requestedResolution') ?? '').trim() || null;
  const evidenceSummary = String(formData.get('evidenceSummary') ?? '').trim() || null;

  if (!projectId || !reason) {
    redirect(`${backTo}?dispute_error=1`);
  }

  // Map dispute category to an appropriate priority level.
  const priorityByCategory: Record<string, string> = {
    payment_dispute: 'urgent',
    safety_concern: 'urgent',
    fraud: 'urgent',
    work_quality: 'normal',
    timeline: 'normal',
    communication: 'low',
    other: 'normal',
  };
  const priority = priorityByCategory[category] ?? 'normal';

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const { data: existingOpen } = await supabase
    .from('disputes')
    .select('id')
    .eq('project_id', projectId)
    .neq('status', 'resolved')
    .limit(1)
    .maybeSingle();

  if (existingOpen?.id) {
    redirect(`${backTo}?dispute_exists=1`);
  }

  const { data: dispute, error } = await supabase
    .from('disputes')
    .insert({
      project_id: projectId,
      raised_by: user.id,
      raised_by_role: profile?.role ?? null,
      category,
      priority,
      requested_resolution: requestedResolution,
      evidence_summary: evidenceSummary,
      reason,
      last_user_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (!error && dispute?.id) {
    await notifyDisputeRaised(dispute.id);
  }

  redirect(`${backTo}?${error ? 'dispute_error=1' : 'dispute_raised=1'}`);
}
