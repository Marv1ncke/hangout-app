// app/api/events/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseForRequest(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  if (!groupId) return NextResponse.json({ events: [], groupProfiles: {} }, { status: 400 });

  const supabase = getSupabaseForRequest(request);

  // Veilige opvraag van groepsleden
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, profiles(id, full_name, avatar_url)")
    .eq("group_id", groupId)
    .eq("status", "active");

  const profilesMap: Record<string, any> = {};
  members?.forEach((m: any) => {
    if (m.profiles) profilesMap[m.profiles.id] = m.profiles;
  });

  // Hoofdquery voor events incl. RSVPs
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("*, event_rsvps(user_id, status)")
    .eq("group_id", groupId)
    .order("start_time", { ascending: true });

  if (eventsError) {
    console.error("events fetch met rsvp-join faalde:", JSON.stringify(eventsError));
    const { data: eventsOnly, error: fallbackError } = await supabase
      .from("events")
      .select("*")
      .eq("group_id", groupId)
      .order("start_time", { ascending: true });

    if (fallbackError) {
      console.error("events fallback-fetch faalde ook:", JSON.stringify(fallbackError));
      return NextResponse.json(
        { events: [], groupProfiles: profilesMap, error: fallbackError.message },
        { status: 500 }
      );
    }

    const eventIds = (eventsOnly ?? []).map((e) => e.id);
    const { data: rsvpRows } = eventIds.length
      ? await supabase.from("event_rsvps").select("event_id, user_id, status").in("event_id", eventIds)
      : { data: [] as any[] };

    const withRsvps = (eventsOnly ?? []).map((e) => ({
      ...e,
      event_rsvps: (rsvpRows ?? []).filter((r: any) => r.event_id === e.id).map((r: any) => ({ user_id: r.user_id, status: r.status })),
    }));

    return NextResponse.json(
      { events: withRsvps, groupProfiles: profilesMap, error: eventsError.message },
      { status: 200 }
    );
  }

  // Zorg dat we ALTIJD het object-formaat { events: [], groupProfiles: {} } teruggeven
  return NextResponse.json({ events: events ?? [], groupProfiles: profilesMap });
}