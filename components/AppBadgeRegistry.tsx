"use client";

import { useEffect } from "react";
import { useNavData } from "@/hooks/useNavData";
import { supabase } from "@/lib/supabase/client";

export default function AppBadgeRegistry() {
  const { data: navData } = useNavData();
  const userId = navData?.user?.id;
  const myGroupIds = (navData?.groups || []).map((g: any) => g.id);

  useEffect(() => {
    if (!userId) {
      if ("clearAppBadge" in navigator) {
        navigator.clearAppBadge().catch((err) =>
          console.error("Fout bij clearen badge (unauthenticated):", err)
        );
      }
      return;
    }

    // Badge = ongelezen personal notifications + openstaande join-requests
    // voor groepen waar ik actief lid van ben. Voorheen telde dit alleen
    // 'notifications', waardoor join-requests (die alleen in group_members
    // leven) nooit het bolletje triggerden.
    const updateBadgeCount = async () => {
      const notificationsPromise = supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false)
        .is("dismissed_at", null);

      const requestsPromise =
        myGroupIds.length > 0
          ? supabase
              .from("group_members")
              .select("*", { count: "exact", head: true })
              .in("group_id", myGroupIds)
              .eq("status", "pending")
          : Promise.resolve({ count: 0, error: null });

      const [notifRes, reqRes] = await Promise.all([
        notificationsPromise,
        requestsPromise,
      ]);

      if (notifRes.error) {
        console.error("Fout bij ophalen notificatie count voor badge:", notifRes.error);
      }
      if (reqRes.error) {
        console.error("Fout bij ophalen join-request count voor badge:", reqRes.error);
      }

      const activeCount = (notifRes.count || 0) + (reqRes.count || 0);

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

    updateBadgeCount();

    const notifChannel = supabase
      .channel(`badge-notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => updateBadgeCount()
      )
      .subscribe();

    // Los kanaal voor group_members: geen user_id-filter mogelijk hier
    // (pending-rijen horen bij de aanvrager, niet bij mij), dus we
    // luisteren breed en filteren client-side via myGroupIds.
    const requestsChannel = supabase
      .channel(`badge-requests-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members" },
        () => updateBadgeCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(requestsChannel);
    };
  }, [userId, JSON.stringify(myGroupIds)]);

  return null;
}