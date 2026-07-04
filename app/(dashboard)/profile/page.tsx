"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ProfilePage() {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;

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

    load();
  }, []);

  async function saveProfile() {
    if (!userId) return;
    setSaving(true);

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Profile saved");
  }

  async function handleFileChange(file?: File) {
    if (!file || !userId) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Please keep avatar images under 5MB.");
      return;
    }

    setUploading(true);

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
      alert(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = data.publicUrl;

    setAvatarUrl(publicUrl);

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    });

    setUploading(false);

    if (profileError) {
      alert(profileError.message);
      return;
    }

    alert("Avatar uploaded");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-sm text-neutral-500">
          Update your name and profile photo.
        </p>
      </div>

      <div className="bg-white border rounded-2xl p-4 md:p-6 space-y-5">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-20 h-20 rounded-full object-cover border"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-black text-white flex items-center justify-center text-2xl font-semibold">
              {(fullName || email || "?").charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0">
            <div className="font-medium">{fullName || "No name yet"}</div>
            <div className="text-sm text-neutral-500 break-all">{email}</div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 rounded-xl border"
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Choose photo"}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Display name</label>
          <input
            className="w-full border rounded-xl p-3"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <button
          onClick={saveProfile}
          disabled={saving}
          className="bg-black text-white px-4 py-2 rounded-xl"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </div>
  );
}