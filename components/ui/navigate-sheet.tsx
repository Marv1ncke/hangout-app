"use client";

import React from "react";
import { DragSheet } from "@/components/ui/drag-sheet";

const BOTTOM_NAV_HEIGHT = 49; // moet matchen met NavigationLayout.tsx nav-hoogte
const SHEET_BOTTOM_OFFSET = `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))`;

interface Props {
  open: boolean;
  onClose: () => void;
  lat: number | null;
  lng: number | null;
  address: string | null;
}

export function NavigateSheet({ open, onClose, lat, lng, address }: Props) {
  const hasCoords = lat != null && lng != null;

  function openGoogleMaps() {
    const url = hasCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address ?? "")}`;
    window.open(url, "_blank");
    onClose();
  }

  function openWaze() {
    const url = hasCoords
      ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(address ?? "")}&navigate=yes`;
    window.open(url, "_blank");
    onClose();
  }

  return (
    <DragSheet open={open} onClose={onClose} title="Navigeren met" bottomOffset={SHEET_BOTTOM_OFFSET}>
      <div className="p-4 space-y-2">
        <button
          onClick={openGoogleMaps}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-background active:scale-[0.98] transition-transform"
        >
          <span className="text-xl">🗺️</span>
          <span className="text-sm font-bold text-foreground">Google Maps</span>
        </button>

        <button
          onClick={openWaze}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-background active:scale-[0.98] transition-transform"
        >
          <span className="text-xl">🚗</span>
          <span className="text-sm font-bold text-foreground">Waze</span>
        </button>
      </div>
    </DragSheet>
  );
}