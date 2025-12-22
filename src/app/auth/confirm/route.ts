import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as
    | 'signup'
    | 'magiclink'
    | 'recovery'
    | 'invite'
    | 'email_change'
    | null;
  const redirectTo = searchParams.get('redirect_to') || '/dashboard';

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    type: type === 'signup' ? 'email' : type === 'recovery' ? 'recovery' : 'magiclink',
    token_hash: tokenHash,
  });

  if (error) {
    console.error('[AuthConfirm] Verification failed:', error.message);
    return NextResponse.redirect(`${origin}/login?error=verification_failed`);
  }

  // For password recovery, redirect to password reset page
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  // For all other types, redirect to the intended destination
  return NextResponse.redirect(`${origin}${redirectTo}`);
}
