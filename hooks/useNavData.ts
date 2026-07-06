/* eslint-disable @typescript-eslint/no-explicit-any */
import useSWR from "swr";
import { supabase } from "@/lib/supabase/client";

export function useNavData() {
  return useSWR("global-nav-data", async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;

    const user = authData?.user;
    if (!user) return null;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, selected_group_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const { data: memberships, error: membershipsError } = await supabase
      .from("group_members")
      .select("id, group_id, user_id, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (membershipsError) throw membershipsError;

    const groupIds = (memberships || []).map((m) => m.group_id);

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
      memberships: memberships || [],
      groups,
      activeGroup,
    };
  });
}