/* eslint-disable @typescript-eslint/no-explicit-any */
import useSWR from "swr";
import { supabase } from "@/lib/supabase/client";

export function useNavData() {
  return useSWR("global-nav-data", async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", userData.user.id)
      .maybeSingle();

    return {
      user: userData.user,
      profile: profile || { full_name: "", avatar_url: "" }
    };
  });
}