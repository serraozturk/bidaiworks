import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * /dashboard/checkout
 *
 * Generic checkout entry.
 *
 * The app is now offers-centered.
 * Real checkout must happen through:
 * /dashboard/checkout/project/[projectId]
 *
 * This page finds the homeowner's latest project waiting for payment and
 * redirects to the project-based checkout.
 */
export default async function CheckoutEntryPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'homeowner') {
    redirect('/dashboard');
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      id,
      status,
      payment_status,
      selected_offer_id,
      awarded_offer_id,
      payment_due_at
    `)
    .eq('homeowner_id', user.id)
    .eq('status', 'pending_payment')
    .eq('payment_status', 'pending')
    .order('payment_due_at', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Checkout entry project query error:', error);
    redirect('/dashboard/homeowner?checkout_error=checkout_entry_failed');
  }

  if (!project) {
    redirect('/dashboard/homeowner?checkout_error=no_pending_checkout');
  }

  const selectedOfferId = project.selected_offer_id ?? project.awarded_offer_id;

  if (!selectedOfferId) {
    redirect(`/dashboard/homeowner/projects/${project.id}?checkout_error=no_selected_offer`);
  }

  if (
    project.payment_due_at &&
    new Date(project.payment_due_at).getTime() < Date.now()
  ) {
    redirect(`/dashboard/homeowner/projects/${project.id}?checkout_error=payment_window_expired`);
  }

  redirect(`/dashboard/checkout/project/${project.id}`);
}