import { redirect } from 'next/navigation';

/**
 * The old "Operations dashboard" duplicated everything that lives on the
 * dedicated pages (projects, contractors, payments, disputes, support).
 * It's been retired — admins land on /admin which is now the single
 * inbox + pulse view.
 */
export default function AdminOperationsRedirect() {
  redirect('/admin');
}
