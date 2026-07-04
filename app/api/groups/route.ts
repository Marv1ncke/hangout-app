import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// CREATE GROUP
export async function POST(req: Request) {
  const { name } = await req.json();

  const invite_code = Math.random().toString(36).substring(2, 8);

  const { data, error } = await supabase
    .from("groups")
    .insert([{ name, invite_code }])
    .select()
    .single();

  if (error) return NextResponse.json({ error }, { status: 400 });

  return NextResponse.json(data);
}

export async function GET() {
  const { data, error } = await supabase.from("groups").select("*");

  if (error) return NextResponse.json({ error }, { status: 400 });

  return NextResponse.json(data);
}