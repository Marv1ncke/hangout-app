"use client";

import { useEffect } from "react";
import { useNavData } from "@/hooks/useNavData";
import { supabase } from "@/lib/supabase/client";

export default function AppBadgeRegistry() {
  const { data: navData } = useNavData();
  const userId = navData?.user?.id;

  useEffect(() => {
    // Als er geen gebruiker is ingelogd, clear de badge direct (Fix Bug 2 - Test 3 & 5)
    if (!userId) {
      if ("clearAppBadge" in navigator) {
        navigator.clearAppBadge().catch((err) => 
          console.error("Fout bij clearen badge (unauthenticated):", err)
        );
      }
      return;
    }

    // Functie om actieve ongelezen notificaties te tellen (Fix Bug 2 - Gewenst gedrag)
    const updateBadgeCount = async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false)
        .is("dismissed_at", null);

      if (error) {
        console.error("Fout bij ophalen notificatie count voor badge:", error);
        return;
      }

      const activeCount = count || 0;

      if ("setAppBadge" in navigator) {
        try {
          if (activeCount > 0) {
            await navigator.setAppBadge(activeCount);
          } else {
            await navigator.clearAppBadge();
          }
        } catch (err) {
          console.error("Fout bij instellen App Badge:", err);
        }
      }
    };

    // 1. Voer direct uit bij laden / login (Fix Bug 2 - Bij app start)
    updateBadgeCount();

    // 2. Luister realtime naar alle wijzigingen in de tabel 'notifications' voor deze gebruiker
    const channel = supabase
      .channel(`badge-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          updateBadgeCount(); // Update badge wanneer notificaties worden gelezen, toegevoegd of dismissed
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Deze component registreert alleen side-effects en rendert geen visuele UI elements
  return null;
}