import { NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
      }
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const { name } = await req.json();
  const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();

  const { data: groupData, error: groupError } = await supabase
    .from("groups")
    .insert([{ name, invite_code }])
    .select()
    .single();

  if (groupError) return NextResponse.json({ error: groupError }, { status: 400 });

  const { error: memberError } = await supabase
    .from("group_members")
    .insert([{ group_id: groupData.id, user_id: user.id, role: "admin" }]);

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  return NextResponse.json(groupData);
}

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); } } }
  );

  const { data, error } = await supabase.from("groups").select("*");
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(data);
}