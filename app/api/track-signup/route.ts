import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side only: gebruikt de service-role key, nooit blootgesteld aan de
// client. Wordt één keer aangeroepen net na signup.
export async function POST(request: Request) {
  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: "userId ontbreekt" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent") ?? "onbekend";
  // Vercel zet deze header automatisch op elke edge-request; geen
  // geolocation-API, geen permissie-prompt, gewoon request-metadata.
  const country = request.headers.get("x-vercel-ip-country") ?? "onbekend";

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ user_agent: userAgent, signup_country: country })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}