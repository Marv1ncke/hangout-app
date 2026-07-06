/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useNavData } from "../../../hooks/useNavData";
import HapticButton from "@/components/HapticButton";
import { Type } from "lucide-react";

const AVAILABLE_FONTS = [
  { id: "inherit", name: "Systeem Standaard" },
  { id: "var(--font-sans), sans-serif", name: "Inter Sans" },
  { id: "var(--font-mono), monospace", name: "JetBrains Mono" },
  { id: "Georgia, serif", name: "Editorial Serif" },
];

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. ZORG DAT WE DIRECT MET DE AL AANWEZIGE CACHE INITIALISEREN
  const { data: navData, mutate: mutateNav } = useNavData();
  
  const cachedProfile = (navData as any)?.profile;
  const userId = cachedProfile?.id || "";
  const email = (navData as any)?.user?.email || "";

  // Lokale input states direct vullen met cache (GEEN FLITS EN GEEN VERTRAGING 👍)
  const [fullName, setFullName] = useState(cachedProfile?.full_name || "");
  const [avatarUrl, setAvatarUrl] = useState(cachedProfile?.avatar_url || "");
  const [activeFont, setActiveFont] = useState("inherit");
  
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Synchroniseer lokale states als de cache op de achtergrond update
  useEffect(() => {
    if (cachedProfile) {
      if (!fullName) setFullName(cachedProfile.full_name || "");
      if (!avatarUrl) setAvatarUrl(cachedProfile.avatar_url || "");
    }
  }, [cachedProfile]);

  // Enkel fonts en auth-check via effect om hydration mismatches te voorkomen
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedFont = localStorage.getItem("app-custom-font");
      if (storedFont) setActiveFont(storedFont);
    }
    
    // Stuur niet-ingelogde gebruikers direct door
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
    });
  }, [router]);

  function handleFontChange(fontId: string) {
    setActiveFont(fontId);
    localStorage.setItem("app-custom-font", fontId);
    window.dispatchEvent(new Event("groupChanged"));
  }

  // 2. INSTANT OPTIMISTIC UPLOAD
  async function handleFileChange(file?: File) {
    if (!file || !userId) return;

    if (!file.type.startsWith("image/")) {
      setStatusMessage({ type: "error", text: "Kies een geldig afbeeldingstype." });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ type: "error", text: "Afbeeldingen moeten kleiner zijn dan 5MB." });
      return;
    }

    setUploading(true);
    setStatusMessage(null);

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      setUploading(false);
      setStatusMessage({ type: "error", text: uploadError.message });
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = data.publicUrl;
    setAvatarUrl(publicUrl);

    // Update navigatie-cache instant
    mutateNav(
      (old: any) => ({
        ...old,
        profile: old?.profile ? { ...old.profile, avatar_url: publicUrl } : null,
      }),
      false
    );

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName.trim(),
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    });

    setUploading(false);
    if (profileError) {
      setStatusMessage({ type: "error", text: profileError.message });
      mutateNav(); 
    } else {
      setStatusMessage({ type: "success", text: "Profielfoto succesvol bijgewerkt! ✨" });
      mutateNav();
    }
  }

  // 3. INSTANT OPTIMISTIC SAVE NAMES
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setStatusMessage(null);

    mutateNav(
      (old: any) => ({
        ...old,
        profile: old?.profile ? { ...old.profile, full_name: fullName.trim() } : null,
      }),
      false
    );

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName.trim(),
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    if (error) {
      setStatusMessage({ type: "error", text: error.message });
      mutateNav(); 
    } else {
      setStatusMessage({ type: "success", text: "Profiel succesvol opgeslagen!" });
      mutateNav();
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    mutateNav(null, false); 
    router.push("/login");
  }

  return (
    <div style={{ fontFamily: activeFont }} className="max-w-xl mx-auto space-y-8 px-2 md:px-0 select-none animate-in fade-in">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-neutral-900">Instellingen</h1>
        <p className="text-sm text-neutral-400 font-bold mt-0.5">Beheer je hangout-identiteit en interface.</p>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-neutral-100/60 space-y-6 shadow-3xs">
        <form onSubmit={saveProfile} className="space-y-6">
          
          <div className="flex items-center gap-5">
            <div 
              onClick={() => !uploading && fileInputRef.current?.click()}
              className="relative h-20 w-20 rounded-full overflow-hidden bg-neutral-900 cursor-pointer group flex-shrink-0 border border-neutral-100"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover transition group-hover:opacity-80" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-white text-2xl font-black">
                  {(fullName || email || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-[10px] text-white font-bold">Wijzig</span>
              </div>
            </div>

            <div className="min-w-0">
              <h3 className="font-black text-neutral-900 tracking-tight truncate">{fullName || "Naam laden..."}</h3>
              <p className="text-xs text-neutral-400 font-bold truncate break-all">{email || "Email laden..."}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-xs font-bold text-neutral-500 hover:text-black underline underline-offset-4 cursor-pointer"
                disabled={uploading}
              >
                {uploading ? "Uploaden..." : "Foto uploaden"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400 px-1">Weergavenaam</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl bg-neutral-50 border border-neutral-100/60 p-3.5 text-sm font-bold outline-none text-neutral-900"
              placeholder="bijv. Markus"
              required
            />
          </div>

          <div className="space-y-2.5 pt-2 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 text-neutral-400 px-1">
              <Type size={14} strokeWidth={2.5} />
              <label className="text-[11px] font-extrabold uppercase tracking-wider">Applicatie Lettertype</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_FONTS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => handleFontChange(font.id)}
                  style={{ fontFamily: font.id }}
                  className={`p-3 text-xs font-bold rounded-xl border text-left transition active:scale-98 cursor-pointer ${
                    activeFont === font.id
                      ? "bg-neutral-900 border-neutral-900 text-white shadow-3xs"
                      : "bg-neutral-50 border-neutral-100 hover:border-neutral-200 text-neutral-800"
                  }`}
                >
                  {font.name}
                </button>
              ))}
            </div>
          </div>

          {statusMessage && (
            <div className={`rounded-xl px-4 py-3 text-xs font-bold ${
              statusMessage.type === "success" 
                ? "bg-green-50 text-green-700 border border-green-100" 
                : "bg-red-50 text-red-700 border border-red-100"
            }`}>
              {statusMessage.text}
            </div>
          )}

          <HapticButton
            type="submit"
            disabled={saving || uploading}
            className="w-full rounded-xl bg-black px-4 py-3.5 text-white text-xs font-bold disabled:opacity-40 transition-all hover:bg-neutral-800"
          >
            {saving ? "Opslaan..." : "Wijzigingen Opslaan"}
          </HapticButton>
        </form>

        <div className="pt-2 border-t border-neutral-100">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl bg-red-50 text-red-600 text-xs font-bold px-4 py-3.5 transition-all hover:bg-red-100/60 cursor-pointer text-center"
          >
            Uitloggen
          </button>
        </div>
      </div>
    </div>
  );
}