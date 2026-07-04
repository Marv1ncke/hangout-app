"use client";

import { create } from "zustand";

type GroupState = {
  groupId: string | null;
  groupName: string | null;
  setGroup: (id: string, name: string) => void;
  clearGroup: () => void;
};

export const useGroup = create<GroupState>((set) => ({
  groupId: null,
  groupName: null,
  setGroup: (id, name) => set({ groupId: id, groupName: name }),
  clearGroup: () => set({ groupId: null, groupName: null }),
}));