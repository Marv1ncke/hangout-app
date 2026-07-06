/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Link } from "next-view-transitions";
import { Calendar, Users, CreditCard, Bell, ChevronDown } from "lucide-react";

interface NavigationLayoutProps {
  children: React.ReactNode;
}

export default function NavigationLayout({ children }: NavigationLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string } | null>(null);
  const [email, setEmail] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [activeGroup, setActiveGroup] = useState<{ id: string; name: string } | null>(null);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/auth");

  const fetchNavData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    setEmail(session.user.email ?? "");

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, selected_group_id")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileData) {
      setProfile({
        full_name: profileData.full_name || "Gebruiker",
        avatar_url: profileData.avatar_url || "",
      });
    }

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
        const current =
          groupsDetails.find(g => g.id === profileData?.selected_group_id) ||
          groupsDetails[0];
        setActiveGroup(current || null);
      }

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

    await supabase
      .from("profiles")
      .update({ selected_group_id: groupId })
      .eq("id", session.user.id);

    setShowGroupSelector(false);
    window.dispatchEvent(new Event("groupChanged"));
  }

  if (isAuthPage) return <>{children}</>;

  // 🛑 Info is hier verwijderd uit de navigatie-items
  const navItems = [
    { label: "Agenda", path: "/events", icon: <Calendar size={20} /> },
    { label: "Groepen", path: "/groups", icon: <Users size={20} /> },
    { label: "Kosten pot", path: "/expenses", icon: <CreditCard size={20} /> },
    { label: "Meldingen", path: "/notifications", badge: pendingCount > 0, icon: <Bell size={20} /> },
  ];

  const initials =
    profile?.full_name?.trim()?.charAt(0)?.toUpperCase() ||
    email?.charAt(0)?.toUpperCase() ||
    "?";

  const isProfileActive = pathname === "/profile";

  return (
    <div className="min-h-screen bg-background/50 text-foreground antialiased md:flex">

      {/* MOBILE HEADER */}
      <header className="native-header flex items-center justify-between px-4 md:hidden select-none">
        <button
          onClick={() => setShowGroupSelector(!showGroupSelector)}
          className="flex items-center space-x-1.5 active:scale-95 transition mt-2"
        >
          <span className="text-base font-black tracking-tight text-neutral-950">
            {activeGroup ? activeGroup.name : "Hangout"}
          </span>
          <ChevronDown size={14} />
        </button>
      </header>

      {/* GROUP SELECTOR */}
      {showGroupSelector && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/10 backdrop-blur-xs"
            onClick={() => setShowGroupSelector(false)}
          />
          <div className="absolute inset-x-0 top-[70px] bg-container-bg border-b border-border p-3 space-y-1">
            {userGroups.map(g => (
              <button
                key={g.id}
                onClick={() => handleGroupSwitch(g.id)}
                className="w-full text-left px-4 py-3 rounded-xl text-xs font-bold"
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 md:flex flex-col justify-between bg-container-bg border-r border-border px-4 py-6" />

      {/* MAIN */}
      <main className="flex-1 w-full md:pl-64 pb-20 md:pb-0">
        <div
          className={`max-w-4xl mx-auto px-4 py-5 md:py-8 transition-opacity duration-150 ${
            transitioning ? "opacity-40" : "opacity-100"
          }`}
        >
          {children}
        </div>
      </main>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden flex justify-around items-center px-2 h-[calc(49px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] z-[99999] bg-background/90 backdrop-blur-md border-t border-border select-none">
        {navItems.map(item => {
          const isActive = pathname === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => {
                setTransitioning(true);
                setTimeout(() => setTransitioning(false), 180);
              }}
              className="flex flex-col items-center justify-center min-w-[60px]"
            >
              <div className={isActive ? "text-white" : "text-neutral-400"}>
                {item.icon}
              </div>
              <span className={`text-[10px] font-bold mt-1 ${isActive ? "text-white" : "text-neutral-400"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* ⚡ PROFIELKNOP (Perfect uitgelijnd, even groot en in dezelfde stijl als de rest) */}
        <Link 
          href="/profile" 
          onClick={() => {
            setTransitioning(true);
            setTimeout(() => setTransitioning(false), 180);
          }}
          className="flex flex-col items-center justify-center min-w-[60px]"
        >
          {profile?.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt="Profile"
              className={`w-5 h-5 rounded-full object-cover border ${
                isProfileActive ? "border-white" : "border-neutral-500"
              }`} 
            />
          ) : (
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
              isProfileActive ? "bg-white text-black" : "bg-neutral-700 text-white"
            }`}>
              {initials}
            </div>
          )}
          <span className={`text-[10px] font-bold mt-1 ${isProfileActive ? "text-white" : "text-neutral-400"}`}>
            Profiel
          </span>
        </Link>
      </nav>
    </div>
  );
}