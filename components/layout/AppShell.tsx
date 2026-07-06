"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { NewHangoutModal } from "@/components/ui/NewHangoutModal";
import { supabase } from "@/lib/supabase/client";
import { Link, useTransitionRouter as useRouter } from "next-view-transitions";

type Profile = {
  full_name: string | null;
  avatar_url: string | null;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;

      setEmail(user.email ?? "");

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      setProfile(profileData ?? null);
    }

    load();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials =
    profile?.full_name?.trim()?.charAt(0)?.toUpperCase() ||
    email?.charAt(0)?.toUpperCase() ||
    "?";

  return (
    <div className="h-screen flex bg-background">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <Topbar />

        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>

        <div className="border-t bg-container-bg p-3">
          <div className="flex justify-end relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-neutral-100 transition"
            >
              <div className="text-right">
                <div className="text-sm font-medium">
                  {profile?.full_name || "Set your name"}
                </div>
                <div className="text-xs text-neutral-500">{email}</div>
              </div>

              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover border"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-btn-bg text-btn-text flex items-center justify-center text-sm font-semibold">
                  {initials}
                </div>
              )}
            </button>

            {open && (
              <div className="absolute bottom-14 right-0 w-56 rounded-2xl border bg-container-bg shadow-lg p-2 z-50">
                <Link
                  href="/profile"
                  className="block rounded-xl px-3 py-2 text-sm hover:bg-neutral-100"
                  onClick={() => setOpen(false)}
                >
                  Account
                </Link>

                <button
                  onClick={logout}
                  className="w-full text-left rounded-xl px-3 py-2 text-sm hover:bg-neutral-100"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>

        <NewHangoutModal />
      </div>
    </div>
  );
}