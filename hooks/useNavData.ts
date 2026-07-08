/* eslint-disable @typescript-eslint/no-explicit-any */
import useSWR, { mutate } from "swr";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

// Lokale opslag-sleutel
const CACHE_KEY = "hangout-local-nav-cache";

export function useNavData() {
  const swrResponse = useSWR("global-nav-data", async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return null;

    const user = authData.user;

    // Parallel ophalen van profiel en memberships
    const [profileResult, membershipsResult] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url, selected_group_id").eq("id", user.id).maybeSingle(),
      supabase.from("group_members").select("id, group_id, user_id, status, created_at").eq("user_id", user.id).eq("status", "active")
    ]);

    if (profileResult.error) throw profileResult.error;
    if (membershipsResult.error) throw membershipsResult.error;

    const profile = profileResult.data;
    const memberships = membershipsResult.data || [];
    const groupIds = memberships.map((m) => m.group_id);

    let groups: any[] = [];
    if (groupIds.length > 0) {
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select("id, name, join_code, invite_code, is_protected, created_by")
        .in("id", groupIds);

      if (groupsError) throw groupsError;
      groups = groupsData || [];
    }

    const activeGroup = groups.find((g) => g.id === profile?.selected_group_id) || groups[0] || null;

    const finalData = {
      user,
      profile: profile || { id: user.id, full_name: "", avatar_url: "", selected_group_id: null },
      memberships,
      groups,
      activeGroup,
    };

    // Sla direct op in localStorage voor de volgende koude start!
    if (typeof window !== "undefined") {
      localStorage.setItem(CACHE_KEY, JSON.stringify(finalData));
    }

    return finalData;
  }, {
    // Schakel agressieve achtergrond-refreshes uit. We verversen handmatig of via Pull-to-Refresh!
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // 1 minuut absolute rust voor de database
    fallbackData: typeof window !== "undefined" && localStorage.getItem(CACHE_KEY)
      ? JSON.parse(localStorage.getItem(CACHE_KEY)!)
      : undefined
  });

  // Luister naar auth wijzigingen
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        if (typeof window !== "undefined") localStorage.removeItem(CACHE_KEY);
        mutate("global-nav-data", null, false);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        mutate("global-nav-data");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return swrResponse;
}


/* eslint-disable @typescript-eslint/no-explicit-any */

export function useGroupMembers(groupId: string | undefined) {
  const cacheKey = groupId ? `group-members-${groupId}` : null;

  return useSWR(cacheKey, async () => {
    if (!groupId) return [];

    // Haal alle actieve leden op + koppel direct hun profieldata (naam en pfp)
    const { data, error } = await supabase
      .from("group_members")
      .select(`
        user_id,
        status,
        profiles!inner (
          full_name,
          avatar_url
        )
      `)
      .eq("group_id", groupId)
      .eq("status", "active");

    if (error) throw error;

    // Transformeer de data naar een plat en makkelijk bruikbaar object
    const members = (data || []).map((m: any) => ({
      user_id: m.user_id,
      full_name: m.profiles?.full_name || "Hangout Lid",
      avatar_url: m.profiles?.avatar_url || "",
    }));

    // Sla direct op in localStorage voor supersnel laden de volgende keer
    if (typeof window !== "undefined") {
      localStorage.setItem(`local-cache-${cacheKey}`, JSON.stringify(members));
    }

    return members;
  }, {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // 1 minuut rust, tenzij er handmatig gepullt wordt
    fallbackData: typeof window !== "undefined" && groupId && localStorage.getItem(`local-cache-group-members-${groupId}`)
      ? JSON.parse(localStorage.getItem(`local-cache-group-members-${groupId}`)!)
      : undefined
  });
}