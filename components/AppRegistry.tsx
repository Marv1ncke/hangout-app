"use client";

import { useEffect, useRef } from "react";

export default function AppRegistry() {
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Activeer Scherm Wake Lock (Scherm blijft aan op terras/bij bonnen tellen)
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch (err) {
        console.log("Wake lock activation failed", err);
      }
    };

    requestWakeLock();

    // Re-activeer wake lock als app terug op de voorgrond komt
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 2. Registreer Periodic Background Sync (Eén keer per 12 uur geruisloos syncen)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(async (registration: any) => {
        if ("periodicSync" in registration) {
          try {
            await registration.periodicSync.register("sync-expenses", {
              minInterval: 12 * 60 * 60 * 1000, // 12 uur interval minimum
            });
          } catch {
            console.log("Periodic Sync niet toegestaan door browser (vereist app installatie)");
          }
        }
      });
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) wakeLockRef.current.release();
    };
  }, []);

  return null;
}