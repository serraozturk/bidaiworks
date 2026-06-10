import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { notifyCheckoutCompleted } from '@/lib/notifications';

interface Params {
  params: { projectId: string };
}

/**
 * Homeowner checkout. Delegates to the shared `homeowner_pay_project` RPC so
 * the web and mobile apps run the identical money state machine. The RPC
 * accepts a project that is `awarded` (accepted via accept_offer/accept_quote,
 * e.g. on mobile) OR `pending_payment` (accepted via reserve_offer_for_payment
 * on web) - so a deal accepted on either platform is always payable here. The
 * RPC atomically holds the project amount + protection hold in escrow, marks
 * the contractor commitment fee due, locks the winning offer, rejects the
 * rest, and posts a system message.
 */
export async function POST(request: Request, { params }: Params) {
  const projectHref = `/dashboard/homeowner/projects/${params.projectId}`;
  const supabase = createServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Recover any lapsed payment / commitment windows first.
  await supabase.rpc('expire_stale_deals').then(
    () => undefined,
    () => undefined,
  );

  const { error } = await supabase.rpc('homeowner_pay_project', {
    p_project_id: params.projectId,
    p_card_last4: null,
  });

  if (error) {
    console.error('Homeowner checkout RPC error:', error);
    return redirectWithError(request, projectHref, error.message);
  }

  await notifyCheckoutCompleted(params.projectId);

  return NextResponse.redirect(
    new URL(`${projectHref}?checkout_success=1`, request.url),
  );
}

function redirectWithError(request: Request, href: string, message: string) {
  const url = new URL(href, request.url);
  url.searchParams.set('checkout_error', message);
  return NextResponse.redirect(url);
}
