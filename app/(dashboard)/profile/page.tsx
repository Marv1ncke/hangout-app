/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Link, useTransitionRouter as useRouter } from "next-view-transitions";
import { supabase } from "@/lib/supabase/client";
import { useNavData } from "../../../hooks/useNavData";
import HapticButton from "@/components/HapticButton";
import { Type, Sun, Moon, Laptop, User, Shield, Info } from "lucide-react";

const AVAILABLE_FONTS = [
  { id: "inherit", name: "Standard", css: "system-ui, sans-serif" },
  { id: "sans-serif", name: "Inter", css: "sans-serif" },
  { id: "monospace", name: "Monospace", css: "monospace" },
  { id: "Georgia, serif", name: "Editorial", css: "Georgia, serif" },
];

type ThemeMode = "light" | "dark" | "system";

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // FIX: Haal 'data' op uit de SWR-hook hook response
  const { data: navData, mutate: mutateNav } = useNavData();
  
  // FIX: SWR response bevat direct het geretourneerde object, pak hier veilig de waardes uit
  const cachedProfile = navData?.profile;
  const email = navData?.user?.email || "";

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [activeFont, setActiveFont] = useState("inherit");
  const [theme, setTheme] = useState<ThemeMode>("system");
  
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // FIX: Synchroniseer invoervelden zodra de gecachte data via SWR/NavData binnenkomt
  useEffect(() => {
    if (cachedProfile) {
      if (!fullName) setFullName(cachedProfile.full_name || "");
      if (!avatarUrl) setAvatarUrl(cachedProfile.avatar_url || "");
    }
  }, [cachedProfile, fullName, avatarUrl]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedFont = localStorage.getItem("app-custom-font");
      if (storedFont) setActiveFont(storedFont);

      const storedTheme = localStorage.getItem("app-theme") as ThemeMode;
      if (storedTheme) setTheme(storedTheme);
    }
    
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
    });
  }, [router]);

  function handleFontChange(fontId: string) {
    setActiveFont(fontId);
    localStorage.setItem("app-custom-font", fontId);
    if (typeof document !== "undefined") {
      document.body.style.fontFamily = fontId === "inherit" ? "" : fontId;
    }
    window.dispatchEvent(new Event("groupChanged"));
  }

  function handleThemeChange(newTheme: ThemeMode) {
    setTheme(newTheme);
    localStorage.setItem("app-theme", newTheme);

    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (newTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(newTheme);
    }
  }

  async function handleFileChange(file?: File) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!file || !user?.id) return;

    if (!file.type.startsWith("image/")) {
      setStatusMessage({ type: "error", text: "Kies een geldig afbeeldingstype." });
      return;
    }

    setUploading(true);
    setStatusMessage(null);

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: true });

    if (uploadError) {
      setUploading(false);
      setStatusMessage({ type: "error", text: uploadError.message });
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = data.publicUrl;
    setAvatarUrl(publicUrl);

    mutateNav((old: any) => ({
      ...old,
      profile: old?.profile ? { ...old.profile, avatar_url: publicUrl } : null,
    }), false);

    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName.trim(),
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    });

    setUploading(false);
    setStatusMessage({ type: "success", text: "Profielfoto succesvol bijgewerkt." });
    mutateNav();
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user?.id) {
      setSaving(false);
      setStatusMessage({ type: "error", text: "Sessie verlopen of ongeldig. Log opnieuw in." });
      return;
    }

    mutateNav((old: any) => ({
      ...old,
      profile: old?.profile ? { ...old.profile, full_name: fullName.trim() } : null,
    }), false);

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName.trim(),
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    if (error) {
      setStatusMessage({ type: "error", text: error.message });
      mutateNav(); 
    } else {
      setStatusMessage({ type: "success", text: "Wijzigingen succesvol opgeslagen." });
      mutateNav();
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    mutateNav(null, false); 
    router.push("/login");
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 px-4 md:px-0 select-none animate-in fade-in bg-background text-foreground pb-24">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Instellingen</h1>
        <p className="text-sm text-neutral-400 font-bold mt-0.5">Beheer je hangout-identiteit en interface.</p>
      </div>

      <form onSubmit={saveProfile} className="space-y-6">

        {/* MIJN IDENTITEIT */}
        <div className="bg-container-bg rounded-2xl p-5 border border-border space-y-5">
          <div className="flex items-center gap-2 text-neutral-400">
            <User size={14} strokeWidth={2.5} />
            <label className="text-[11px] font-extrabold uppercase tracking-wider">Mijn Identiteit</label>
          </div>

          <div className="flex items-center gap-5">
            <div 
              onClick={() => !uploading && fileInputRef.current?.click()}
              className="relative h-20 w-20 rounded-full overflow-hidden bg-neutral-900 cursor-pointer group flex-shrink-0 border border-border"
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
              <h3 className="font-black tracking-tight truncate">{fullName || "Naam laden..."}</h3>
              <p className="text-xs text-neutral-400 font-bold truncate break-all">{email || "Email laden..."}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-xs font-bold text-neutral-500 hover:text-foreground underline underline-offset-4 cursor-pointer"
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
              className="w-full rounded-xl bg-background border border-border p-3.5 text-sm font-bold outline-none text-foreground focus:ring-1 focus:ring-foreground/20"
              placeholder="bijv. Markus"
              required
            />
          </div>

          {statusMessage && (
            <div className={`rounded-xl px-4 py-3 text-xs font-bold ${
              statusMessage.type === "success" 
                ? "bg-green-500/10 text-green-500 border border-green-500/20" 
                : "bg-red-500/10 text-red-500 border border-red-500/20"
            }`}>
              {statusMessage.text}
            </div>
          )}

          <HapticButton
            type="submit"
            disabled={saving || uploading}
            className="w-full rounded-xl bg-btn-bg px-4 py-3.5 text-btn-text text-xs font-bold disabled:opacity-40 transition-all hover:bg-btn-hover"
          >
            {saving ? "Opslaan..." : "Wijzigingen Opslaan"}
          </HapticButton>
        </div>
      </form>

      {/* INTERFACE (past direct toe, geen opslaan nodig) */}
      <div className="space-y-6">
        <div className="bg-container-bg rounded-2xl p-5 border border-border space-y-5">
          
          {/* THEMA */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-neutral-400 px-1">
              <Sun size={14} strokeWidth={2.5} />
              <label className="text-[11px] font-extrabold uppercase tracking-wider">Weergave modus</label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["light", "dark", "system"] as ThemeMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleThemeChange(m)}
                  className={`p-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer ${
                    theme === m
                      ? "bg-btn-bg border-btn-bg text-btn-text shadow-3xs"
                      : "bg-background border-border hover:border-neutral-400 text-foreground"
                  }`}
                >
                  {m === "light" && <Sun size={13} />}
                  {m === "dark" && <Moon size={13} />}
                  {m === "system" && <Laptop size={13} />}
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* LETTERTYPE SELECTOR */}
          <div className="space-y-2.5 pt-2 border-t border-border">
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
                  style={{ fontFamily: font.css }}
                  className={`p-3 text-xs font-bold rounded-xl border text-left transition active:scale-98 cursor-pointer ${
                    activeFont === font.id
                      ? "bg-btn-bg border-btn-bg text-btn-text shadow-3xs"
                      : "bg-background border-border hover:border-neutral-400 text-foreground"
                  }`}
                >
                  {font.name}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* APPLICATIE INFO ROW */}
      <div className="bg-container-bg rounded-2xl p-5 border border-border space-y-4">
        <div className="flex items-center gap-1.5 text-neutral-400">
          <Info size={14} strokeWidth={2.5} />
          <label className="text-[11px] font-extrabold uppercase tracking-wider">Over de Applicatie</label>
        </div>
        <Link
          href="/info"
          className="flex items-center justify-between w-full rounded-xl bg-background border border-border px-4 py-3.5 text-xs font-bold transition-all hover:border-neutral-400 active:scale-98 cursor-pointer"
        >
          <span className="text-foreground">Bekijk info & updates</span>
          <Info size={16} className="text-neutral-400" />
        </Link>
      </div>

      <div className="bg-container-bg rounded-2xl p-5 border border-border space-y-4">
        <div className="flex items-center gap-1.5 text-neutral-400">
          <Shield size={14} strokeWidth={2.5} />
          <label className="text-[11px] font-extrabold uppercase tracking-wider">Accountbeheer</label>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-bold px-4 py-3.5 transition-all hover:bg-red-500/20 cursor-pointer text-center"
        >
          Uitloggen uit app
        </button>
      </div>
    </div>
  );
}