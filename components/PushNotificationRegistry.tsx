"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

// Helper om base64 naar UInt8Array te converteren voor de VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationRegistry() {
  useEffect(() => {
    async function registerPush() {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        return;
      }

      try {
        // 1. Registreer de Service Worker
        const registration = await navigator.serviceWorker.register("/sw.js");
        
        // 2. Vraag toestemming
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        // 3. Haal de publieke VAPID sleutel op (genereer deze in Supabase)
        const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_KEY;
        if (!PUBLIC_VAPID_KEY) return;

        // 4. Abonneer de gebruiker op de push server
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
        });

        // 5. Sla het abonnement op in Supabase gekoppeld aan de user
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;

        await supabase.from("push_subscriptions").upsert({
          user_id: userData.user.id,
          subscription: subscription.toJSON(),
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Push registratie mislukt:", error);
      }
    }

    registerPush();
  }, []);

  return null;
}