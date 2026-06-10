import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function HomeownerOnboarding() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  await supabase.from('profiles').update({ role: 'homeowner' }).eq('id', user.id);

  redirect('/dashboard/homeowner');
}