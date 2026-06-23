import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';

function getPublicOrigin(rawOrigin: string) {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    rawOrigin
  )
    .trim()
    .replace(/\/$/, '');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams, origin: rawOrigin } = url;

  const origin = getPublicOrigin(rawOrigin);

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/dashboard';

  const supabase = createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('Auth callback code exchange error:', error);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('Auth callback OTP verify error:', error);
  }

  return NextResponse.redirect(`${origin}/login?error=callback`);
}