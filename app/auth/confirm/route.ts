import { NextResponse } from 'next/server';
import { type EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  // Belangrijk: deze app bewaart de sessie in localStorage (lib/supabase/client.ts),
  // niet in cookies. verifyOtp hier server-side (cookie-based) zou een sessie
  // zetten die de browser-client nooit ziet -> gebruiker lijkt "niet ingelogd"
  // na bevestiging. Daarom NIET hier verifiëren: geef token_hash/type door aan
  // een client-side pagina die verifyOtp via de browser-Supabase-client aanroept.
  if (token_hash && type) {
    const url = new URL('/auth/confirm-result', request.url);
    url.searchParams.set('token_hash', token_hash);
    url.searchParams.set('type', type);
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL('/auth/confirm-result?error=missing_token', request.url));
}