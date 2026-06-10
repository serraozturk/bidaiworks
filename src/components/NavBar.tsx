import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/env';
import { LogoutButton } from './LogoutButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type UserRole = 'homeowner' | 'contractor' | 'admin';

export async function NavBar() {
  if (!hasSupabaseEnv()) {
    return <GuestNav />;
  }

  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return <GuestNav />;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role as UserRole | undefined;

  const dashboardHref =
    role === 'admin'
      ? '/admin'
      : role === 'contractor'
        ? '/dashboard/contractor'
        : role === 'homeowner'
          ? '/dashboard/homeowner'
          : '/dashboard';

  const dashboardLabel =
    role === 'admin'
      ? 'Admin panel'
      : role === 'contractor'
        ? 'Contractor dashboard'
        : role === 'homeowner'
          ? 'My projects'
          : 'Dashboard';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-black tracking-tight text-[#071631]"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#071631] text-xs font-black text-white shadow-sm">
            b
          </span>
          bidAI
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          <Link
            href={dashboardHref}
            className="rounded-lg px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {dashboardLabel}
          </Link>

          {role !== 'admin' && (
            <Link
              href="/dashboard/settings"
              className="rounded-lg px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Settings
            </Link>
          )}

          {role === 'admin' && (
            <Link
              href="/admin"
              className="rounded-lg px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Operations
            </Link>
          )}

          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}

function GuestNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-black tracking-tight text-[#071631]"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#071631] text-xs font-black text-white shadow-sm">
            b
          </span>
          bidAI
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Log in
          </Link>

          <Link
            href="/signup"
            className="rounded-lg bg-[#f45112] px-4 py-2 font-black text-white shadow-sm transition hover:bg-[#d94406]"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}