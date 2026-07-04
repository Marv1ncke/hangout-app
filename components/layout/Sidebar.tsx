"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Calendar, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useGroup } from "@/components/state/useGroup";

const nav = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Groups", href: "/groups", icon: Users },
    { label: "Calendar", href: "/events", icon: Calendar },
    { label: "Availability", href: "/availability", icon: Clock },
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
        .eq("user_id", user.id);

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
      const selected =
        groupList.find((g) => g.id === selectedId) || groupList[0];

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
    <aside className="w-72 h-full border-r bg-white flex flex-col">
      <div className="p-4 border-b space-y-3">
        <div className="font-bold text-lg">Hangout</div>

        <div className="relative">
          <button
            onClick={() => setOpenGroups((v) => !v)}
            className="w-full rounded-xl border px-3 py-2 text-left hover:bg-neutral-50"
          >
            <div className="text-xs text-neutral-500">Current group</div>
            <div className="font-medium">
              {groupName || "Select a group"}
            </div>
          </button>

          {openGroups && (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border bg-white shadow-lg p-2 z-50">
              {groups.length === 0 ? (
                <div className="px-3 py-2 text-sm text-neutral-500">
                  No groups yet
                </div>
              ) : (
                groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => chooseGroup(group)}
                    className={cn(
                      "w-full text-left rounded-xl px-3 py-2 text-sm hover:bg-neutral-100",
                      groupId === group.id && "bg-neutral-100"
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

      <nav className="flex-1 p-2 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
                active
                  ? "bg-black text-white"
                  : "hover:bg-neutral-100 text-neutral-700"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 text-xs text-neutral-400 border-t">MVP v0.1</div>
    </aside>
  );
}