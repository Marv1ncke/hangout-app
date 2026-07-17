import { NextResponse } from "next/server";

// Wachtwoord wordt server-side vergeleken; komt nooit in de client-bundle
// terecht (in tegenstelling tot een hardcoded string in een "use client"
// bestand, die iedereen met devtools kan uitlezen).
export async function POST(request: Request) {
  const { password } = await request.json();
  const ADMIN_PASSWORD = process.env.ADMIN_DASHBOARD_PASSWORD ?? "SuperGeheimInformaticaStudentenWachtwoord2026";

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Kort-levend token, enkel om de sessie in de admin-pagina te bewaren
  // (localStorage), geen echte auth-vervanging maar wel beter dan een
  // wachtwoord dat zichtbaar in de bundle staat.
  return NextResponse.json({ ok: true, token: Buffer.from(`${Date.now()}`).toString("base64") });
}