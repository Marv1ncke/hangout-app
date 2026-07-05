/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Link } from "next-view-transitions";
import { Calendar, Users, Clock, CreditCard, Bell, Info, ChevronDown } from "lucide-react";

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

  const fetchNavData = useCallback(async () => {
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
  }, [router]);

  useEffect(() => {
    if (isAuthPage) return;
    fetchNavData();

    window.addEventListener("groupChanged", fetchNavData);
    return () => window.removeEventListener("groupChanged", fetchNavData);
  }, [pathname, isAuthPage, fetchNavData]);

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
    { label: "Meldingen", path: "/notifications", badge: pendingCount > 0, icon: <Bell size={20} strokeWidth={2.5} /> },
    { label: "Info", path: "/info", icon: <Info size={20} strokeWidth={2.5} /> },
  ];

  const isProfileActive = pathname === "/profile";

  return (
    <div className="min-h-screen bg-neutral-50/50 text-neutral-900 antialiased flex flex-col md:flex-row">
      
      {/* 📱 NATIVE SOCIAL MOBILE TOP BAR - ZONDER PROFIELFOTO */}
      <header className="native-header flex items-center justify-between px-4 md:hidden select-none">
        <button 
          onClick={() => setShowGroupSelector(!showGroupSelector)} 
          className="flex items-center space-x-1.5 active:scale-95 transition mt-2"
        >
          <span className="text-base font-black tracking-tight text-neutral-950">
            {activeGroup ? activeGroup.name : "Hangout"}
          </span>
          <ChevronDown size={14} className={`text-neutral-400 transition-transform ${showGroupSelector ? "rotate-180" : ""}`} />
        </button>
      </header>

      {/* MOBILE GROUP SWITCHER DROP PANEL */}
      {showGroupSelector && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-xs md:hidden" onClick={() => setShowGroupSelector(false)} />
          <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+56px)] z-50 bg-white border-b border-neutral-100 p-3 space-y-1 animate-in slide-in-from-top-2 md:hidden">
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
        {/* desktop layout ... */}
      </aside>

      {/* MAIN LAYOUT WRAPPER */}
      <main className="flex-1 w-full min-h-screen md:pl-64">
        <div className="max-w-4xl mx-auto px-4 py-5 md:py-8">
          {children}
        </div>
      </main>

      {/* 📱 NATIVE MOBILE BOTTOM NAV - INCLUSIEF PROFIELFOTO RECHTSONDER */}
      <nav className="native-bottom-bar fixed bottom-0 left-0 right-0 w-full flex items-center justify-around px-2 z-40 md:hidden select-none">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path} 
              className={`flex flex-col items-center justify-center space-y-0.5 w-12 h-12 relative native-nav-link ${isActive ? "text-black" : "text-neutral-400"}`}
            >
              {item.icon}
              <span className="text-[9px] font-bold tracking-tight">{item.label.split(" ")[0]}</span>
              {item.badge && !isActive && <span className="absolute top-2 right-3 h-2 w-2 rounded-full bg-red-500" />}
            </Link>
          );
        })}

        {/* PROFIELFOTO GEÏNTEGREERD ALS LAATSTE KNOTS ELEMENT */}
        <Link 
          href="/profile" 
          className={`flex flex-col items-center justify-center space-y-0.5 w-12 h-12 relative native-nav-link ${isProfileActive ? "text-black" : "text-neutral-400"}`}
        >
          <div className={`h-5 w-5 rounded-full overflow-hidden border transition-all ${isProfileActive ? "border-black scale-105" : "border-neutral-200"}`}>
            <img src={profile?.avatar_url} alt="Profile" className="h-full w-full object-cover" />
          </div>
          <span className="text-[9px] font-bold tracking-tight">Profiel</span>
        </Link>
      </nav>

    </div>
  );
}