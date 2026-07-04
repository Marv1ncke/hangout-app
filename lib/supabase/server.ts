import { createServerClient } from "@supabase/ssr";

export function supabaseServer(cookies: any) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies.get(name)?.value;
        },
      },
    }
  );
}