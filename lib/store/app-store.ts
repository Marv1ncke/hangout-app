"use client";

import { create } from "zustand";
import { supabase } from "@/lib/supabase/client";

export type AppProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  selected_group_id: string | null;
};

export type AppGroup = {
  id: string;
  name: string;
  join_code: string | null;
  invite_code: string | null;
  is_protected: boolean | null;
};

type AppStore = {
  bootstrapped: boolean;
  loading: boolean;

  userId: string | null;
  email: string | null;
  profile: AppProfile | null;

  groups: AppGroup[];
  activeGroupId: string | null;

  routeTransitioning: boolean;
  setRouteTransitioning: (v: boolean) => void;

  setActiveGroupIdLocal: (groupId: string | null) => void;
  bootstrap: () => Promise<void>;
  refreshGroups: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAppStore = create<AppStore>((set, get) => ({
  bootstrapped: false,
  loading: true,

  userId: null,
  email: null,
  profile: null,

  groups: [],
  activeGroupId: null,

  routeTransitioning: false,
  setRouteTransitioning: (v: boolean) => set({ routeTransitioning: v }),

  setActiveGroupIdLocal: (groupId) => set({ activeGroupId: groupId }),

  bootstrap: async () => {
    set({ loading: true });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      set({
        bootstrapped: true,
        loading: false,
        userId: null,
        email: null,
        profile: null,
        groups: [],
        activeGroupId: null,
      });
      return;
    }

    const userId = user.id;
    const email = user.email ?? null;

    const [{ data: profile }, { data: memberships }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, selected_group_id")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId)
        .eq("status", "active"),
    ]);

    let groups: AppGroup[] = [];
    const groupIds = memberships?.map((m) => m.group_id) ?? [];

    if (groupIds.length > 0) {
      const { data: groupsData } = await supabase
        .from("groups")
        .select("id, name, join_code, invite_code, is_protected")
        .in("id", groupIds);

      groups = groupsData ?? [];
    }

    set({
      bootstrapped: true,
      loading: false,
      userId,
      email,
      profile: profile ?? null,
      groups,
      activeGroupId: profile?.selected_group_id ?? null,
    });
  },

  refreshProfile: async () => {
    const userId = get().userId;
    if (!userId) return;

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, selected_group_id")
      .eq("id", userId)
      .maybeSingle();

    if (data) {
      set({
        profile: data,
        activeGroupId: data.selected_group_id ?? null,
      });
    }
  },

  refreshGroups: async () => {
    const userId = get().userId;
    if (!userId) return;

    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId)
      .eq("status", "active");

    const groupIds = memberships?.map((m) => m.group_id) ?? [];

    if (groupIds.length === 0) {
      set({ groups: [] });
      return;
    }

    const { data: groupsData } = await supabase
      .from("groups")
      .select("id, name, join_code, invite_code, is_protected")
      .in("id", groupIds);

    set({ groups: groupsData ?? [] });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      bootstrapped: true,
      loading: false,
      userId: null,
      email: null,
      profile: null,
      groups: [],
      activeGroupId: null,
    });
  },
}));