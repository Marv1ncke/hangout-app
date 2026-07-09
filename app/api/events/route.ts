import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  if (!groupId) return NextResponse.json([], { status: 400 });

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, profiles(id, full_name, avatar_url)")
    .eq("group_id", groupId)
    .eq("status", "active");

  const profilesMap: Record<string, any> = {};
  members?.forEach((m: any) => {
    if (m.profiles) profilesMap[m.profiles.id] = m.profiles;
  });

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("*, event_rsvps(user_id, status)")
    .eq("group_id", groupId)
    .order("start_time", { ascending: true });

  if (eventsError) {
    console.error("events fetch met rsvp-join faalde:", eventsError.message);
    // fallback: events zonder de rsvp-join, zodat de agenda sowieso
    // gevuld raakt zelfs als de join (bv. door RLS/relatie-issue) faalt
    const { data: eventsOnly, error: fallbackError } = await supabase
      .from("events")
      .select("*")
      .eq("group_id", groupId)
      .order("start_time", { ascending: true });

    if (fallbackError) {
      console.error("events fallback-fetch faalde ook:", fallbackError.message);
      return NextResponse.json(
        { events: [], groupProfiles: profilesMap, error: fallbackError.message },
        { status: 500 }
      );
    }

    const withEmptyRsvps = (eventsOnly ?? []).map((e) => ({ ...e, event_rsvps: [] }));
    return NextResponse.json({ events: withEmptyRsvps, groupProfiles: profilesMap });
  }

  return NextResponse.json({ events: events ?? [], groupProfiles: profilesMap });
}