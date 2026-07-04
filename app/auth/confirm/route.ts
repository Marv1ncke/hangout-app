import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/dashboard';

  if (token_hash && type) {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Valideer de token die via de mail is binnengekomen
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });

    if (!error) {
      // Succes! Stuur ze door naar het dashboard (of de pagina in 'next')
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // Mislukt? Stuur terug naar login met een duidelijke foutmelding
  return NextResponse.redirect(new URL('/login?error=Invalid or expired link', request.url));
}