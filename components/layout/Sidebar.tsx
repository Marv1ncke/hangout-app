"use client";

import { Link } from "next-view-transitions";
;
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Calendar, Clock, Bell } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useGroup } from "@/components/state/useGroup";

// Navigation met de nieuwe Meldingen pagina erbij
const nav = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Groepen", href: "/groups", icon: Users },
  { label: "Kalender", href: "/events", icon: Calendar },
  { label: "Beschikbaarheid", href: "/availability", icon: Clock },
  { label: "Meldingen", href: "/notifications", icon: Bell }, // <-- STAAT DEZE ER?
];

type Group = {
  id: string;
  name: string;
};

export function Sidebar() {
  const pathname = usePathname();
  const { groupId, groupName, setGroup } = useGroup();

  const [groups, setGroups] = useState<Group[]>([]);
  const [openGroups, setOpenGroups] = useState(false);

  useEffect(() => {
    async function loadGroups() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;

      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("status", "active"); // Alleen actieve groepen inladen

      const ids = (memberships || []).map((m) => m.group_id);
      if (!ids.length) return;

      const { data: groupRows } = await supabase
        .from("groups")
        .select("id, name")
        .in("id", ids);

      const groupList = groupRows || [];
      setGroups(groupList);

      const { data: profile } = await supabase
        .from("profiles")
        .select("selected_group_id")
        .eq("id", user.id)
        .maybeSingle();

      const selectedId = profile?.selected_group_id;
      const selected = groupList.find((g) => g.id === selectedId) || groupList[0];

      if (selected) {
        setGroup(selected.id, selected.name);

        if (!selectedId) {
          await supabase
            .from("profiles")
            .upsert({ id: user.id, selected_group_id: selected.id });
        }
      }
    }

    loadGroups();
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

  return (
    <aside className="w-full md:w-72 h-full border-r border-neutral-100 bg-white flex flex-col">
      <div className="p-5 border-b border-neutral-100 space-y-4">
        <div className="font-black text-2xl tracking-tight text-neutral-900">Hangout.</div>

        <div className="relative">
          <button
            onClick={() => setOpenGroups((v) => !v)}
            className="w-full rounded-2xl border border-neutral-200/60 bg-neutral-50 px-4 py-3.5 text-left active:scale-95 transition-all flex flex-col"
          >
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">Huidige Groep</div>
            <div className="font-bold text-neutral-900 text-sm truncate">
              {groupName || "Geen groep geselecteerd"}
            </div>
          </button>

          {openGroups && (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-neutral-100 bg-white shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
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
                      groupId === group.id ? "bg-neutral-100 text-black" : "text-neutral-600 hover:bg-neutral-50"
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
                  ? "bg-black text-white shadow-sm font-bold"
                  : "hover:bg-neutral-50 text-neutral-600 font-medium active:bg-neutral-100"
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className="text-base">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-5 text-[11px] font-bold text-neutral-300 uppercase tracking-widest border-t border-neutral-100">
        MVP v0.2 • Apple Style
      </div>
    </aside>
  );
}