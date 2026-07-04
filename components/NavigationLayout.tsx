"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

interface NavigationLayoutProps {
  children: React.ReactNode;
}

export default function NavigationLayout({ children }: NavigationLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string } | null>(null);

  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/auth");

  useEffect(() => {
    if (isAuthPage) return;

    async function fetchUserProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", session.user.id)
        .maybeSingle();

      if (data) {
        setProfile({
          full_name: data.full_name || "Gebruiker",
          avatar_url: data.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.full_name || "U")}`,
        });
      }
    }

    fetchUserProfile();
  }, [pathname, isAuthPage, router]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  // Exact gematcht op jouw app mappenstructuur met strakke SVG Icons (Apple Minimalisme)
  const navItems = [
    { 
      label: "Agenda", 
      path: "/events", 
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      label: "Groepen", 
      path: "/groups", 
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    { 
      label: "Beschikbaarheid", 
      path: "/availability", 
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white px-4 py-6 md:py-8">
      <div className="space-y-8">
        {/* Brand Header (Geen onnodige borders) */}
        <div className="px-2 flex items-center space-x-2.5">
          <div className="h-6 w-6 rounded-md bg-black flex items-center justify-center text-white text-[11px] font-black tracking-tighter">H</div>
          <span className="font-bold text-base tracking-tight text-neutral-900">Hangout</span>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                <span className={isActive ? "text-neutral-900" : "text-neutral-400"}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Profielbalk onderaan: Directe link naar /profile zonder dropdowns */}
      {profile && (
        <Link 
          href="/profile"
          onClick={() => setIsMobileMenuOpen(false)}
          className="flex items-center space-x-3 rounded-xl p-2 active:bg-neutral-100 transition-all"
        >
          <img
            src={profile.avatar_url}
            alt="Profile Avatar"
            className="h-10 w-10 rounded-full object-cover bg-neutral-100 flex-shrink-0"
          />
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-semibold text-neutral-900">{profile.full_name}</p>
            <p className="text-xs text-neutral-400 font-medium">Bekijk profiel</p>
          </div>
        </Link>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-neutral-100">
      
      {/* MOBILE HEADER CAP (Clean native look, borderless border simulation via shade) */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-white/80 px-5 backdrop-blur-lg md:hidden">
        <div className="flex items-center space-x-2.5">
          <div className="h-6 w-6 rounded-md bg-black flex items-center justify-center text-white text-[11px] font-black tracking-tighter">H</div>
          <span className="text-base font-bold tracking-tight">Hangout</span>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="rounded-full p-2 active:bg-neutral-100 text-neutral-900 focus:outline-none transition-all"
        >
          {isMobileMenuOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </header>

      <div className="flex">
        {/* DESKTOP SIDEBAR PANEL (Geen lelijke borders, rust op subtiele achtergrondscheiding) */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 md:block bg-white border-r border-neutral-100">
          {sidebarContent}
        </aside>

        {/* MOBILE SIDEBAR DRAWEROVERLAY */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            <div className="fixed inset-0 bg-black/10 backdrop-blur-md transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
            <aside className="relative z-50 w-72 h-full bg-white transform dynamic-slide-in">
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* MAIN BODY LAYOUT PANEL (Geframed op basis van Apple's breedtes) */}
        <main className="flex-1 w-full min-h-screen md:pl-64">
          <div className="max-w-4xl mx-auto px-5 py-6 md:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}