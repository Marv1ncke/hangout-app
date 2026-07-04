"use client";

import { useEffect } from "react";

export default function AppBadgeRegistry() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
      navigator.setAppBadge(3).catch((err) => 
        console.error("Badge error:", err)
      );
    }
  }, []);

  return null; // Deze component rendert niks visieels, voert alleen de actie uit
}