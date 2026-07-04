/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import { Check, X, BellOff } from "lucide-react";

interface JoinRequest {
  id: string;
  group_id: string;
  user_id: string;
  status: string;
  created_at: string;
  group_name: string;
  user_name: string;
  user_avatar: string;
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Trigger tijdelijke iOS-stijl notificatie-banner binnen de app
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  async function loadNotifications() {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const currentUserId = userData.user.id;

      // 1. Haal alle actieve groepen op waar JIJ in zit (want als groepslid mag je aanvragen goedkeuren)
      const { data: myMemberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", currentUserId)
        .eq("status", "active");

      if (!myMemberships || myMemberships.length === 0) {
        setRequests([]);
        return;
      }

      const myGroupIds = myMemberships.map((m) => m.group_id);

      // 2. Haal alle 'pending' aanvragen op van deze groepen
      const { data: pendingRequests, error } = await supabase
        .from("group_members")
        .select(`
          id,
          group_id,
          user_id,
          status,
          created_at,
          groups:group_id ( name ),
          profiles:user_id ( full_name, avatar_url )
        `)
        .in("group_id", myGroupIds)
        .eq("status", "pending");

      if (error) throw error;

      if (pendingRequests) {
        const formatted = (pendingRequests as any[]).map((r) => ({
          id: r.id,
          group_id: r.group_id,
          user_id: r.user_id,
          status: r.status,
          created_at: r.created_at,
          group_name: r.groups?.name || "Onbekende Groep",
          user_name: r.profiles?.full_name || "Nieuw Lid",
          user_avatar: r.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${r.user_id}`,
        }));
        setRequests(formatted);
      }
    } catch (err) {
      console.error("Fout bij laden van notificaties:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  // Actie: Accepteer lid in de groep
  async function handleAction(requestId: string, approve: boolean, userName: string, groupName: string) {
    try {
      if (approve) {
        // Update status naar active
        const { error } = await supabase
          .from("group_members")
          .update({ status: "active" })
          .eq("id", requestId);

        if (error) throw error;
        showToast(`🎉 ${userName} is toegevoegd aan ${groupName}!`);
      } else {
        // Verwijder het verzoek bij weigeren
        const { error } = await supabase
          .from("group_members")
          .delete()
          .eq("id", requestId);

        if (error) throw error;
        showToast(`Afgewezen: ${userName} krijgt geen toegang.`);
      }

      // Refresh de lijst direct zonder hapering
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error(err);
      showToast("Oeps, er ging iets mis bij het verwerken.");
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm font-bold text-neutral-400 animate-pulse tracking-tight">
        Meldingen ophalen...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-24 relative select-none">
      
      {/* Dynamic Activity Toast */}
      {toast && (
        <div className="fixed bottom-6 left-4 right-4 z-50 flex justify-center pointer-events-none animate-in slide-in-from-bottom-4">
          <div className="bg-neutral-900 text-white font-bold text-xs px-5 py-3.5 rounded-2xl shadow-2xl tracking-tight pointer-events-auto">
            {toast}
          </div>
        </div>
      )}

      {/* Page Title */}
      <div className="border-b border-neutral-100 pb-5">
        <h1 className="text-3xl font-black tracking-tight text-neutral-900">Activiteit</h1>
        <p className="text-sm text-neutral-400 font-medium mt-0.5">
          Verzoeken voor toegang tot je privé groepen.
        </p>
      </div>

      {/* Notifications Conditional Render */}
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-12 bg-neutral-50 rounded-3xl border border-neutral-100/60 space-y-3">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-3xs text-neutral-400">
            <BellOff size={22} />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-800 tracking-tight">Helemaal up-to-date</p>
            <p className="text-xs text-neutral-400 mt-0.5">Er zijn momenteel geen openstaande toetredingsverzoeken.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider px-1">
            Toetredingsverzoeken ({requests.length})
          </h2>

          <div className="space-y-2.5">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-white border border-neutral-100 p-4 rounded-2xl flex items-center justify-between gap-4 transition-all hover:border-neutral-200/80 shadow-3xs"
              >
                {/* User Info & Target Group */}
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 border border-neutral-100">
                    <Image
                      src={req.user_avatar}
                      alt={req.user_name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-neutral-900 tracking-tight leading-snug">
                      <span className="font-black text-black">{req.user_name}</span> wil meedoen met{" "}
                      <span className="text-blue-600 font-extrabold">#{req.group_name}</span>
                    </p>
                    <p className="text-[10px] text-neutral-400 font-medium mt-0.5">
                      {new Date(req.created_at).toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {/* Big UX Action Buttons - Perf voor duim-taps op mobiel */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleAction(req.id, false, req.user_name, req.group_name)}
                    className="w-10 h-10 bg-neutral-100 hover:bg-neutral-200/70 text-neutral-600 rounded-xl flex items-center justify-center transition active:scale-90 cursor-pointer"
                    title="Weigeren"
                  >
                    <X size={18} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => handleAction(req.id, true, req.user_name, req.group_name)}
                    className="w-10 h-10 bg-black hover:bg-neutral-900 text-white rounded-xl flex items-center justify-center transition active:scale-90 cursor-pointer"
                    title="Accepteren"
                  >
                    <Check size={18} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}