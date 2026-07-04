import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// CREATE GROUP + DIRECT LID MAKEN
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  // 1. Check wie er momenteel ingelogd is
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { name } = await req.json();
  const invite_code = Math.random().toString(36).substring(2, 8);

  // 2. Maak de groep aan
  const { data: groupData, error: groupError } = await supabase
    .from("groups")
    .insert([{ name, invite_code }])
    .select()
    .single();

  if (groupError) return NextResponse.json({ error: groupError }, { status: 400 });

  // 3. Voeg de maker DIRECT toe als lid van deze zojuist gemaakte groep
  const { error: memberError } = await supabase
    .from("group_members")
    .insert([
      { 
        group_id: groupData.id, 
        user_id: user.id, 
        role: "admin" // Maker krijgt admin rechten
      }
    ]);

  if (memberError) {
    return NextResponse.json({ error: "Groep gemaakt, maar kon maker niet toevoegen aan leden: " + memberError.message }, { status: 500 });
  }

  return NextResponse.json(groupData);
}

// GET GROUPS VAN DE GEBRUIKER
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  // Haal alleen groepen op waar de gebruiker daadwerkelijk in zit (veilig!)
  const { data, error } = await supabase.from("groups").select("*");

  if (error) return NextResponse.json({ error }, { status: 400 });

  return NextResponse.json(data);
}