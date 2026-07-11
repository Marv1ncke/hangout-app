"use client";

import React from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  lat: number | null;
  lng: number | null;
  address: string | null;
}

export function NavigateSheet({ open, onClose, lat, lng, address }: Props) {
  if (!open) return null;

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
    <div className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-container-bg w-full sm:max-w-xs rounded-t-3xl sm:rounded-2xl p-4 space-y-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-xs font-bold text-muted-foreground">Navigeren met</span>
          <button onClick={onClose} className="size-7 flex items-center justify-center rounded-full bg-background">
            <X size={14} />
          </button>
        </div>

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
    </div>
  );
}