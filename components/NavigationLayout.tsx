/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Link } from "next-view-transitions";
import { Calendar, Users, CreditCard, Bell, ChevronDown, Check } from "lucide-react";
import { useNavData } from "@/hooks/useNavData";
import { useSWRConfig } from "swr";
import { InstallPromptReopenButton } from "@/components/ui/install-prompt";
import { useToast } from "@/components/providers/ToastProvider";

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
  const { mutate: globalMutate } = useSWRConfig();
  const { showToast } = useToast();
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

  // Pending-count: los van de hoofd-nav-data, maar nu ook realtime, zodat
  // een nieuw join-verzoek meteen het bel-icoontje bijwerkt zonder refresh.
  useEffect(() => {
    if (isAuthPage || !navData?.groups?.length) {
      setPendingCount(0);
      return;
    }
    const groupIds = navData.groups.map((g: any) => g.id);

    const refreshPendingCount = () => {
      supabase
        .from("group_members")
        .select("*", { count: "exact", head: true })
        .in("group_id", groupIds)
        .eq("status", "pending")
        .then(({ count }) => setPendingCount(count || 0));
    };

    refreshPendingCount();

    const channel = supabase
      .channel(`nav-pending-${groupIds.join("-")}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => refreshPendingCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthPage, navData?.groups]);

  async function handleGroupSwitch(groupId: string) {
    if (!navData?.user?.id) return;

    const newGroupName = navData?.groups?.find((g: any) => g.id === groupId)?.name ?? "groep";

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
    showToast(`Gewisseld naar ${newGroupName}`, "success");

    const { error } = await supabase
      .from("profiles")
      .update({ selected_group_id: groupId })
      .eq("id", navData.user.id);

    if (error) {
      await mutateNav();
    }

    // Elke pagina die op groupId filtert (events, expenses, ...) gebruikt
    // een eigen SWR-key zoals "/api/events?groupId=<oude-groep>". Die
    // revalideert niet automatisch mee met navData, dus zonder dit bleef
    // de oude groep zichtbaar totdat je handmatig wegnavigeerde en terugkwam.
    globalMutate(
      (key) => typeof key === "string" && key.includes("groupId="),
      undefined,
      { revalidate: true }
    );
  }

  // App-opstart overlay: voorkomt de korte flits van de dashboard-UI vóórdat
  // we weten of iemand ingelogd is. Verdwijnt zodra navData bekend is
  // (succesvol geladen, of null = geen sessie -> redirect volgt hierboven).
  const isBooting = !isAuthPage && navData === undefined;

  if (isAuthPage) return <>{children}</>;

  if (isBooting) {
    return (
      <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-foreground/5 flex items-center justify-center animate-pulse">
            <div className="w-7 h-7 rounded-lg bg-foreground/20 animate-[boot-scale_1.1s_ease-in-out_infinite]" />
          </div>
        </div>
        <style>{`
          @keyframes boot-scale {
            0%, 100% { transform: scale(0.85); opacity: 0.6; }
            50% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // Info is hier verwijderd uit de navigatie-items
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
        {userGroups.length > 1 ? (
          <button
            onClick={() => setShowGroupSelector(!showGroupSelector)}
            className="flex items-center space-x-1.5 active:scale-95 transition mt-2"
          >
            <span className="text-base font-black tracking-tight text-foreground">
              {activeGroup ? activeGroup.name : "Hangout"}
            </span>
            <ChevronDown
              size={14}
              className={`text-foreground transition-transform duration-200 ${showGroupSelector ? "rotate-180" : ""}`}
            />
          </button>
        ) : (
          <span className="text-base font-black tracking-tight text-foreground mt-2">
            {activeGroup ? activeGroup.name : "Hangout"}
          </span>
        )}
        <div className="mt-2">
          <InstallPromptReopenButton compact />
        </div>
      </header>

      {/* GROUP SELECTOR */}
      {showGroupSelector && userGroups.length > 1 && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/10 backdrop-blur-xs animate-in fade-in-0 duration-200"
            onClick={() => setShowGroupSelector(false)}
          />
          <div className="absolute inset-x-0 top-[70px] mx-3 rounded-2xl backdrop-blur-xl bg-container-bg/80 border border-white/10 shadow-lg p-3 space-y-1 max-h-[60vh] overflow-y-auto animate-in fade-in-0 slide-in-from-top-3 duration-200 ease-out">
            {userGroups.length === 0 && (
              <p className="px-4 py-3 text-xs font-bold text-muted-foreground">Je bent nog in geen enkele groep.</p>
            )}
            {userGroups.map((g: any) => {
              const isActive = g.id === activeGroup?.id;
              return (
                <button
                  key={g.id}
                  onClick={() => { if (!isActive) handleGroupSwitch(g.id); else setShowGroupSelector(false); }}
                  className={`w-full flex items-center justify-between text-left px-4 py-3 rounded-xl text-xs font-bold transition-colors ${
                    isActive ? "bg-btn-bg text-btn-text" : "text-foreground active:bg-background"
                  }`}
                >
                  <span className="truncate">{g.name}</span>
                  {isActive && <Check size={14} strokeWidth={3} className="shrink-0 ml-2" />}
                </button>
              );
            })}
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
              <div className={`relative ${isActive ? "text-foreground" : "text-neutral-400"}`}>
                {item.icon}
                {item.badge && (
                  <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-background" />
                )}
              </div>
              <span className={`text-[10px] font-bold mt-1 ${isActive ? "text-foreground" : "text-neutral-400"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* PROFIELKNOP (Perfect uitgelijnd, even groot en in dezelfde stijl als de rest) */}
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
                isProfileActive ? "border-foreground" : "border-neutral-500"
              }`} 
            />
          ) : (
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
              isProfileActive ? "bg-foreground text-background" : "bg-neutral-700 text-white"
            }`}>
              {initials}
            </div>
          )}
          <span className={`text-[10px] font-bold mt-1 ${isProfileActive ? "text-foreground" : "text-neutral-400"}`}>
            Profiel
          </span>
        </Link>
      </nav>
    </div>
  );
}