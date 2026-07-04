/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { Calendar, Users, Clock, CreditCard, Bell, Info, User, ChevronDown } from "lucide-react";

interface NavigationLayoutProps {
  children: React.ReactNode;
}

export default function NavigationLayout({ children }: NavigationLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeGroup, setActiveGroup] = useState<{ id: string; name: string } | null>(null);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [showGroupSelector, setShowGroupSelector] = useState(false);

  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/auth");

  async function fetchNavData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    // 1. Profiel & actieve groep
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, selected_group_id")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileData) {
      setProfile({
        full_name: profileData.full_name || "Gebruiker",
        avatar_url: profileData.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profileData.full_name || "U")}`,
      });
    }

    // 2. Groepen ophalen voor top-bar switcher
    const { data: myMemberships } = await supabase
      .from("group_members")
      .select("group_id, status")
      .eq("user_id", session.user.id);

    const activeMemberships = myMemberships?.filter(m => m.status === "active") || [];
    const pendingMemberships = myMemberships?.filter(m => m.status === "pending") || [];

    if (activeMemberships.length > 0) {
      const myGroupIds = activeMemberships.map(m => m.group_id);
      
      const { data: groupsDetails } = await supabase
        .from("groups")
        .select("id, name")
        .in("id", myGroupIds);

      if (groupsDetails) {
        setUserGroups(groupsDetails);
        const current = groupsDetails.find(g => g.id === profileData?.selected_group_id) || groupsDetails[0];
        setActiveGroup(current || null);
      }

      // Notificatie badge aantal
      const { count } = await supabase
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .in("group_id", myGroupIds)
        .eq("status", "pending");
      
      setPendingCount((count || 0) + pendingMemberships.length);
    }
  }

  useEffect(() => {
    if (isAuthPage) return;
    fetchNavData();

    window.addEventListener("groupChanged", fetchNavData);
    return () => window.removeEventListener("groupChanged", fetchNavData);
  }, [pathname, isAuthPage]);

  async function handleGroupSwitch(groupId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    await supabase.from("profiles").update({ selected_group_id: groupId }).eq("id", session.user.id);
    setShowGroupSelector(false);
    window.dispatchEvent(new Event("groupChanged"));
  }

  if (isAuthPage) return <>{children}</>;

  const navItems = [
    { label: "Agenda", path: "/events", icon: <Calendar size={20} strokeWidth={2.5} /> },
    { label: "Groepen", path: "/groups", icon: <Users size={20} strokeWidth={2.5} /> },
    { label: "Bezetting", path: "/availability", icon: <Clock size={20} strokeWidth={2.5} /> },
    { label: "Kosten pot", path: "/expenses", icon: <CreditCard size={20} strokeWidth={2.5} /> },
    { label: "Meldingen", path: "/notifications", pathAlt: "/notifications", badge: pendingCount > 0, icon: <Bell size={20} strokeWidth={2.5} /> },
    { label: "Info", path: "/info", icon: <Info size={20} strokeWidth={2.5} /> },
  ];

  return (
    <div className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-neutral-100 flex flex-col md:flex-row">
      
      {/* 📱 NATIVE SOCIAL MOBILE TOP BAR */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between bg-white/80 px-4 backdrop-blur-md md:hidden border-b border-neutral-100/60 select-none">
        <button 
          onClick={() => setShowGroupSelector(!showGroupSelector)} 
          className="flex items-center space-x-1.5 active:scale-95 transition"
        >
          <span className="text-base font-black tracking-tight text-neutral-950">{activeGroup ? activeGroup.name : "Hangout"}</span>
          <ChevronDown size={14} className={`text-neutral-400 transition-transform ${showGroupSelector ? "rotate-180" : ""}`} />
        </button>

        <Link href="/profile" className="h-7 w-7 rounded-full overflow-hidden border border-neutral-200">
          <img src={profile?.avatar_url} alt="Profile" className="h-full w-full object-cover" />
        </Link>
      </header>

      {/* MOBILE GROUP SWITCHER DROP PANEL */}
      {showGroupSelector && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-xs md:hidden" onClick={() => setShowGroupSelector(false)} />
          <div className="fixed inset-x-0 top-14 z-50 bg-white border-b border-neutral-100 p-3 space-y-1 animate-in slide-in-from-top-2 md:hidden">
            {userGroups.map((g) => (
              <button
                key={g.id}
                onClick={() => handleGroupSwitch(g.id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeGroup?.id === g.id ? "bg-black text-white" : "bg-neutral-50 text-neutral-700 hover:bg-neutral-100"}`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 🖥️ DESKTOP SIDEBAR PANEL */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 md:flex flex-col justify-between bg-white border-r border-neutral-100 px-4 py-6 select-none">
        <div className="space-y-8">
          <div className="px-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-6 w-6 rounded-lg bg-black flex items-center justify-center text-white text-[11px] font-black shadow-3xs">H</div>
              <span className="font-black text-base tracking-tight text-neutral-900">Hangout.</span>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm transition-all active:scale-98 ${
                    isActive ? "bg-neutral-900 text-white font-bold shadow-xs" : "text-neutral-500 hover:text-neutral-900 font-medium hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className={isActive ? "text-white" : "text-neutral-400"}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && !isActive && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {profile && (
          <Link href="/profile" className="flex items-center space-x-3 rounded-xl p-2.5 hover:bg-neutral-50 transition border border-neutral-100/50 mx-1">
            <img src={profile.avatar_url} alt="Avatar" className="h-9 w-9 rounded-full object-cover shadow-3xs" />
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-xs font-bold text-neutral-900 tracking-tight">{profile.full_name}</p>
              <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">Profiel</p>
            </div>
          </Link>
        )}
      </aside>

      {/* MAIN LAYOUT WRAPPER */}
      <main className="flex-1 w-full min-h-screen md:pl-64 pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto px-4 py-5 md:py-8">
          {children}
        </div>
      </main>

      {/* 📱 NATIVE SOCIAL MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-md border-t border-neutral-100 h-16 flex items-center justify-around px-2 z-40 md:hidden select-none">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path} 
              className={`flex flex-col items-center justify-center space-y-1 w-12 h-12 relative ${isActive ? "text-black" : "text-neutral-400"}`}
            >
              {item.icon}
              <span className="text-[9px] font-bold tracking-tight">{item.label.split(" ")[0]}</span>
              {item.badge && !isActive && <span className="absolute top-2 right-3 h-2 w-2 rounded-full bg-red-500" />}
            </Link>
          );
        })}
      </nav>

    </div>
  );
}