/* eslint-disable @typescript-eslint/no-explicit-any */
import useSWR, { mutate } from "swr";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export function useNavData() {
  const swrResponse = useSWR("global-nav-data", async () => {
    // 1. Haal de geauthenticeerde user op via de veilige methode
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return null;
    }

    const user = authData.user;

    // 2. Parallel ophalen van profiel en memberships om watervallen te voorkomen
    const [profileResult, membershipsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, selected_group_id")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("group_members")
        .select("id, group_id, user_id, status, created_at")
        .eq("user_id", user.id)
        .eq("status", "active")
    ]);

    if (profileResult.error) throw profileResult.error;
    if (membershipsResult.error) throw membershipsResult.error;

    const profile = profileResult.data;
    const memberships = membershipsResult.data || [];
    const groupIds = memberships.map((m) => m.group_id);

    // 3. Haal de groepen op als er memberships zijn
    let groups: any[] = [];
    if (groupIds.length > 0) {
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select("id, name, join_code, invite_code, is_protected, created_by")
        .in("id", groupIds);

      if (groupsError) throw groupsError;
      groups = groupsData || [];
    }

    const activeGroup =
      groups.find((g) => g.id === profile?.selected_group_id) || groups[0] || null;

    return {
      user,
      profile: profile || {
        id: user.id,
        full_name: "",
        avatar_url: "",
        selected_group_id: null,
      },
      memberships,
      groups,
      activeGroup,
    };
  });

  // Luister naar auth veranderingen om de SWR cache direct te muteren/clearen (Fix Bug 3 - Test 3)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        mutate("global-nav-data", null, false);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        mutate("global-nav-data");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return swrResponse;
}