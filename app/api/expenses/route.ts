import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Zelfde patroon als /api/events: de sessie zit in localStorage, niet in
// cookies, dus de server route moet het access-token uit de Authorization-
// header lezen (meegestuurd door de globale SWR-fetcher in AppProviders.tsx).
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
  if (!groupId) return NextResponse.json([], { status: 400 });

  const supabase = getSupabaseForRequest(request);

  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, profiles(id, full_name, avatar_url)")
    .eq("group_id", groupId)
    .eq("status", "active");

  const formattedMembers = members?.map((m: any) => m.profiles).filter(Boolean) || [];

  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("*, expense_payers(user_id, paid_amount), expense_shares(user_id, share_amount)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("expenses fetch faalde:", error.message);
    return NextResponse.json(
      { members: formattedMembers, expenses: [], error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ members: formattedMembers, expenses: expenses ?? [] });
}