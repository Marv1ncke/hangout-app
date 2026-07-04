"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function loadProfileData() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        setFullName(profile.full_name ?? "");
        setAvatarUrl(profile.avatar_url ?? "");
      } else {
        await supabase.from("profiles").insert({
          id: user.id,
          full_name: user.user_metadata?.full_name ?? "",
          avatar_url: "",
        });
        setFullName(user.user_metadata?.full_name ?? "");
      }
    }

    loadProfileData();
  }, [router]);

  async function handleFileChange(file?: File) {
    if (!file || !userId) return;

    if (!file.type.startsWith("image/")) {
      setStatusMessage({ type: "error", text: "Please select a valid image file." });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ type: "error", text: "Images must be under 5MB." });
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

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName.trim(),
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    });

    setUploading(false);
    if (profileError) {
      setStatusMessage({ type: "error", text: profileError.message });
    } else {
      setStatusMessage({ type: "success", text: "Photo uploaded successfully!" });
      setTimeout(() => window.location.reload(), 1000);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setStatusMessage(null);

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName.trim(),
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    if (error) {
      setStatusMessage({ type: "error", text: error.message });
    } else {
      setStatusMessage({ type: "success", text: "Profile updated successfully!" });
      setTimeout(() => window.location.reload(), 1000);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    setTimeout(() => window.location.reload(), 100);
  }

  return (
    <div className="max-w-xl mx-auto space-y-8 px-2 md:px-0">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Account Settings</h1>
        <p className="text-sm text-neutral-500 mt-1">Manage your hangout profile identity.</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100/60 space-y-6">
        <form onSubmit={saveProfile} className="space-y-6">
          
          {/* Minimalist Avatar Circle Frame */}
          <div className="flex items-center gap-5">
            <div 
              onClick={() => !uploading && fileInputRef.current?.click()}
              className="relative h-20 w-20 rounded-full overflow-hidden bg-neutral-100 cursor-pointer group flex-shrink-0 border border-neutral-100"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover transition group-hover:opacity-80" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-neutral-900 text-white text-2xl font-medium">
                  {(fullName || email || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-[10px] text-white font-medium">Change</span>
              </div>
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold text-neutral-800 truncate">{fullName || "Set your name"}</h3>
              <p className="text-xs text-neutral-400 truncate break-all">{email}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-xs font-medium text-neutral-600 hover:text-black underline underline-offset-4"
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Upload Photo"}
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
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Display Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl bg-neutral-50 border-0 p-3.5 text-sm outline-none focus:ring-2 focus:ring-black/5 placeholder-neutral-400"
              placeholder="e.g. Markus"
              required
            />
          </div>

          {statusMessage && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
              statusMessage.type === "success" 
                ? "bg-green-50 text-green-700 border border-green-100" 
                : "bg-red-50 text-red-700 border border-red-100"
            }`}>
              {statusMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || uploading}
            className="w-full rounded-xl bg-black px-4 py-3 text-white text-sm font-medium disabled:opacity-40 transition-all hover:bg-neutral-800"
          >
            {saving ? "Saving changes..." : "Save"}
          </button>
        </form>

        <div className="pt-4 border-t border-neutral-100">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl bg-red-50 text-red-600 text-sm font-medium px-4 py-3 transition-all hover:bg-red-100/60"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}