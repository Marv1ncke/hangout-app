/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";

interface PendingRequest {
  id: string;
  group_id: string;
  user_id: string;
  group_name: string;
  user_name: string;
  avatar_url: string;
  created_at: string;
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  
  // Voorkomt render loop cascades
  const isMounted = useRef(true);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      if (isMounted.current) setToast(null);
    }, 3000);
  };

  // Gescheiden handler losgekoppeld van de directe render-cycle
  async function fetchNotificationsData() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user || !isMounted.current) return;
      const currentUserId = userData.user.id;

      const { data: myMemberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", currentUserId)
        .eq("status", "active");

      if (myMemberships && myMemberships.length > 0 && isMounted.current) {
        const groupIds = myMemberships.map(m => m.group_id);

        const { data: incoming } = await supabase
          .from("group_members")
          .select(`
            id,
            group_id,
            user_id,
            created_at,
            groups:group_id ( name ),
            profiles:user_id ( full_name, avatar_url )
          `)
          .in("group_id", groupIds)
          .eq("status", "pending");

        if (incoming && isMounted.current) {
          const formatted = (incoming as any[]).map(req => ({
            id: req.id,
            group_id: req.group_id,
            user_id: req.user_id,
            group_name: req.groups?.name || "Groep",
            user_name: req.profiles?.full_name || "Iemand",
            avatar_url: req.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${req.user_id}`,
            created_at: req.created_at
          }));
          setPendingRequests(formatted);
        }
      } else if (isMounted.current) {
        setPendingRequests([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    isMounted.current = true;
    
    // Roep data fetch asynchroon en veilig aan buiten de render context
    fetchNotificationsData();

    return () => {
      isMounted.current = false;
    };
  }, []);

  async function handleResolveRequest(requestId: string, approve: boolean) {
    if (approve) {
      await supabase.from("group_members").update({ status: "active" }).eq("id", requestId);
      showToast("Lid succesvol toegelaten! 🎉");
    } else {
      await supabase.from("group_members").delete().eq("id", requestId);
      showToast("Verzoek geweigerd.");
    }
    setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    await fetchNotificationsData();
  }

  if (loading) return <div className="p-6 text-sm text-neutral-400 font-medium">Meldingen laden...</div>;

  return (
    <div className="space-y-6 page-transition-wrapper min-h-screen pb-20 relative">
      
      {/* TOAST BANNER */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-50 flex justify-center pointer-events-none animate-fade-in">
          <div className="bg-black text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md pointer-events-auto">
            {toast}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="border-b border-neutral-100 pb-5">
        <h1 className="text-3xl font-black tracking-tight text-neutral-900">Meldingen</h1>
        <p className="text-sm text-neutral-400 font-medium mt-0.5">Keur lidmaatschapsverzoeken goed of wijs ze af.</p>
      </div>

      {/* NOTIFICATIE LIJST */}
      <div className="space-y-3">
        {pendingRequests.length === 0 ? (
          <div className="bg-neutral-50 rounded-2xl p-8 text-center border border-neutral-100/40 animate-fade-in">
            <p className="text-sm text-neutral-400 italic">Heerlijk rustig! Geen openstaande verzoeken.</p>
          </div>
        ) : (
          <div className="space-y-2 animate-fade-in">
            {pendingRequests.map(req => {
              const dateObj = new Date(req.created_at);
              const formattedTime = dateObj.toLocaleDateString("nl-BE", { day: "numeric", month: "short" }) + " om " + dateObj.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });

              return (
                <div key={req.id} className="bg-amber-50/60 border border-amber-200/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 border border-amber-200 bg-white">
                      <Image src={req.avatar_url} alt="Avatar" fill className="object-cover" unoptimized />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs text-neutral-800 leading-normal">
                        <strong className="font-bold text-neutral-900">{req.user_name}</strong> wilt lid worden van <em className="font-semibold text-neutral-900">“{req.group_name}”</em>. Klik op accepteer om toe te laten, of weiger om te annuleren.
                      </p>
                      <span className="text-[10px] text-neutral-400 block font-medium">{formattedTime}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button onClick={() => handleResolveRequest(req.id, false)} className="text-xs font-bold text-neutral-500 hover:text-red-600 px-3 py-1.5 rounded-lg transition cursor-pointer">Weiger</button>
                    <button onClick={() => handleResolveRequest(req.id, true)} className="bg-black text-white text-xs font-bold px-4 py-1.5 rounded-xl shadow-xs cursor-pointer">Accepteer</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}