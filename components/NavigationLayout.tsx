/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Link } from "next-view-transitions";
import { Calendar, Users, CreditCard, Bell, ChevronDown } from "lucide-react";
import { useNavData } from "@/hooks/useNavData";

interface NavigationLayoutProps {
  children: React.ReactNode;
}

export default function NavigationLayout({ children }: NavigationLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Eén gedeelde databron voor de hele app. Dit is dezelfde SWR-cache/key als
  // groups/page.tsx gebruikt, dus een mutateNav() daar (bv. na groep aanmaken/
  // wisselen) werkt deze navigatiebalk automatisch bij — geen los "groupChanged"
  // event meer nodig als los sync-mechanisme.
  const { data: navData, mutate: mutateNav } = useNavData();
  const [pendingCount, setPendingCount] = useState(0);
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/auth");

  const profile = navData?.profile
    ? { full_name: navData.profile.full_name || "Gebruiker", avatar_url: navData.profile.avatar_url || "" }
    : null;
  const email = navData?.user?.email ?? "";
  const activeGroup = navData?.activeGroup ?? null;
  const userGroups = navData?.groups ?? [];

  // Stuur niet-ingelogde gebruikers door zodra we zeker weten dat er geen sessie is
  // (navData === null na een geslaagde fetch betekent: geen user).
  useEffect(() => {
    if (isAuthPage) return;
    if (navData === null) router.push("/login");
  }, [navData, isAuthPage, router]);

  // Pending-count blijft een losse, lichte query (los van de hoofd-nav-data),
  // want die moet vaker kunnen verversen zonder de hele nav cache te triggeren.
  useEffect(() => {
    if (isAuthPage || !navData?.groups?.length) {
      setPendingCount(0);
      return;
    }
    const groupIds = navData.groups.map((g: any) => g.id);
    supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .in("group_id", groupIds)
      .eq("status", "pending")
      .then(({ count }) => setPendingCount(count || 0));
  }, [isAuthPage, navData?.groups]);

  async function handleGroupSwitch(groupId: string) {
    if (!navData?.user?.id) return;

    // Optimistic update: nav-balk wisselt direct, geen wachttijd.
    mutateNav(
      (old: any) => ({
        ...old,
        activeGroup: old?.groups?.find((g: any) => g.id === groupId) ?? old?.activeGroup,
        profile: old?.profile ? { ...old.profile, selected_group_id: groupId } : old?.profile,
      }),
      false
    );
    setShowGroupSelector(false);

    const { error } = await supabase
      .from("profiles")
      .update({ selected_group_id: groupId })
      .eq("id", navData.user.id);

    if (error) {
      await mutateNav();
    }
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