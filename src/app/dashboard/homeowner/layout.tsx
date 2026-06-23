import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';

/**
 * Homeowner layout — suspension guard for ALL /dashboard/homeowner/* routes.
 * Suspended homeowners are shown a locked-out screen instead of the dashboard.
 */
export default async function HomeownerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended, suspension_reason')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'homeowner') redirect('/dashboard');

  // Block suspended homeowners
  if ((profile as any)?.suspended) {
    const reason = (profile as any).suspension_reason as string | null;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] px-4 py-16 text-center">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 shadow-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
            🚫
          </div>
          <h1 className="text-2xl font-black text-slate-900">Account suspended</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Your bidAI account has been suspended by our moderation team.
          </p>
          {reason && (
            <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-left text-sm text-red-800">
              <strong className="font-black">Reason:</strong> {reason}
            </div>
          )}
          <p className="mt-4 text-sm text-slate-500">
            If you believe this is a mistake, please{' '}
            <a href="mailto:support@bidai.com" className="font-bold text-orange-600 underline">
              contact support
            </a>
            .
          </p>
          <div className="mt-6 flex justify-center">
            <LogoutButton />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
