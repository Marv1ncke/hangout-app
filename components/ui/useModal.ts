import { create } from "zustand";

export type EventDraft = {
  id?: string;
  title?: string;
  start?: Date;
  end?: Date;
};

type ModalState = {
  open: boolean;
  draft: EventDraft | null;
  openModal: (draft?: EventDraft) => void;
  closeModal: () => void;
};

export const useModal = create<ModalState>((set) => ({
  open: false,
  draft: null,
  openModal: (draft) => set({ open: true, draft: draft ?? null }),
  closeModal: () => set({ open: false, draft: null }),
}));