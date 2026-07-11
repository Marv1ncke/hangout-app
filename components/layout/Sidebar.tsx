"use client";

import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, Calendar, Clock, Bell } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useGroup } from "@/components/state/useGroup";

const nav = [
  { label: "Agenda", href: "/events", icon: Calendar },
  { label: "Groepen", href: "/groups", icon: Users },
  { label: "Beschikbaarheid", href: "/availability", icon: Clock },
  { label: "Meldingen", href: "/notifications", icon: Bell },
];

type Group = {
  id: string;
  name: string;
};

type Profile = {
  full_name: string | null;
  avatar_url: string | null;
};

export function Sidebar() {
  const pathname = usePathname();
  const { groupId, groupName, setGroup } = useGroup();

  const [groups, setGroups] = useState<Group[]>([]);
  const [openGroups, setOpenGroups] = useState(false);
  
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function loadData() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;

      setEmail(user.email ?? "");

      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("status", "active");

      const ids = (memberships || []).map((m) => m.group_id);
      if (ids.length) {
        const { data: groupRows } = await supabase
          .from("groups")
          .select("id, name")
          .in("id", ids);

        const groupList = groupRows || [];
        setGroups(groupList);

        const { data: profileRows } = await supabase
          .from("profiles")
          .select("selected_group_id, full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (profileRows) {
          setProfile({
            full_name: profileRows.full_name,
            avatar_url: profileRows.avatar_url,
          });
        }

        const selectedId = profileRows?.selected_group_id;
        const selected = groupList.find((g) => g.id === selectedId) || groupList[0];

        if (selected) {
          setGroup(selected.id, selected.name);
          if (!selectedId) {
            await supabase
              .from("profiles")
              .upsert({ id: user.id, selected_group_id: selected.id });
          }
        }
      } else {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        
        setProfile(profileRows ?? null);
      }
    }

    loadData();
  }, [setGroup]);

  async function chooseGroup(group: Group) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;

    setGroup(group.id, group.name);
    setOpenGroups(false);

    await supabase
      .from("profiles")
      .upsert({ id: user.id, selected_group_id: group.id });
  }

  const initials =
    profile?.full_name?.trim()?.charAt(0)?.toUpperCase() ||
    email?.charAt(0)?.toUpperCase() ||
    "?";

  const isProfileActive = pathname === "/profile";

  return (
    <aside className="w-full md:w-72 h-full border-r border-border bg-container-bg flex flex-col justify-between">
      {/* BOVENSTE GEDEELTE */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="p-5 border-b border-border space-y-4">
          <div className="font-black text-2xl tracking-tight text-foreground">Hangout.</div>

          <div className="relative">
            <button
              onClick={() => setOpenGroups((v) => !v)}
              className="w-full rounded-2xl border border-border/60 bg-background px-4 py-3.5 text-left active:scale-95 transition-all flex flex-col"
            >
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Huidige Groep</div>
              <div className="font-bold text-foreground text-sm truncate">
                {groupName || "Geen groep geselecteerd"}
              </div>
            </button>

            {openGroups && (
              <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-border bg-container-bg shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                {groups.length === 0 ? (
                  <div className="px-3 py-4 text-sm font-medium text-neutral-400 text-center">
                    Je zit nog in geen enkele groep.
                  </div>
                ) : (
                  groups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => chooseGroup(group)}
                      className={cn(
                        "w-full text-left rounded-xl px-4 py-3.5 text-sm font-bold transition-colors active:bg-neutral-100",
                        groupId === group.id ? "bg-neutral-100 text-foreground" : "text-neutral-600 hover:bg-background"
                      )}
                    >
                      {group.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* HOOFDNAVIGATIE */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto scrollbar-none">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all",
                  active
                    ? "bg-btn-bg text-btn-text shadow-sm font-bold"
                    : "hover:bg-background text-neutral-600 font-medium active:bg-neutral-100"
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                <span className="text-base">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ONDERSTE GEDEELTE (Profielknop als volwaardig menu-item) */}
      <div className="p-3 border-t border-border bg-container-bg space-y-3">
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-4 px-4 py-3 rounded-2xl transition-all w-full text-left",
            isProfileActive
              ? "bg-btn-bg text-btn-text shadow-sm font-bold"
              : "hover:bg-background text-neutral-600 font-medium active:bg-neutral-100"
          )}
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Profile"
              className={cn(
                "w-[22px] h-[22px] rounded-full object-cover border flex-shrink-0",
                isProfileActive ? "border-btn-text/40" : "border-border"
              )}
            />
          ) : (
            <div className={cn(
              "w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0",
              isProfileActive ? "bg-background text-foreground" : "bg-btn-bg text-btn-text"
            )}>
              {initials}
            </div>
          )}
          <span className="text-base truncate">
            {profile?.full_name || "Mijn Profiel"}
          </span>
        </Link>

        <div className="px-4 text-[11px] font-bold text-neutral-300 uppercase tracking-widest">
          MVP v0.2 • Apple Style
        </div>
      </div>
    </aside>
  );
}