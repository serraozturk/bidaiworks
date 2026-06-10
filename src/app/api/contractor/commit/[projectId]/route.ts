import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { notifyContractorCommitted } from '@/lib/notifications';

interface Params {
  params: { projectId: string };
}

/**
 * Contractor commitment payment. Delegates to the shared
 * `contractor_pay_commitment` RPC (the same RPC the mobile app calls). The RPC
 * verifies the caller is the awarded contractor, atomically activates the job
 * (status -> in_progress), records the 8% commitment fee on the payment
 * ledger, logs an audit event, and posts a system message that unlocks chat.
 */
export async function POST(request: Request, { params }: Params) {
  const commitHref = `/dashboard/contractor/jobs/${params.projectId}/commit`;
  const supabase = createServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  await supabase.rpc('expire_stale_deals').then(
    () => undefined,
    () => undefined,
  );

  const { error } = await supabase.rpc('contractor_pay_commitment', {
    p_project_id: params.projectId,
  });

  if (error) {
    console.error('Contractor commitment RPC error:', error);
    const url = new URL(commitHref, request.url);
    url.searchParams.set('commit_error', error.message);
    return NextResponse.redirect(url);
  }

  await notifyContractorCommitted(params.projectId);

  return NextResponse.redirect(
    new URL(
      `/dashboard/contractor/projects/${params.projectId}?committed=1`,
      request.url,
    ),
  );
}
