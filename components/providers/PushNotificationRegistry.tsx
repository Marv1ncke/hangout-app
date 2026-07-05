"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

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
        // 0. Only request subscriptions if the user is authenticated
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return; 

        // 1. Register Service Worker File
        const registration = await navigator.serviceWorker.register("/sw.js");
        
        // 2. Request Notification Permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        // 3. Extract public VAPID Key from environment variables
        const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_KEY;
        if (!PUBLIC_VAPID_KEY) {
          console.warn("PushNotificationRegistry: NEXT_PUBLIC_VAPID_KEY is missing.");
          return;
        }

        // 4. Subscribe the browser instance to your push subscription stream
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
        });

        // 5. Store/Upsert user push registration to Supabase database
        await supabase.from("push_subscriptions").upsert({
          user_id: userData.user.id,
          subscription: subscription.toJSON(),
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Push registration failure details:", error);
      }
    }

    registerPush();
  }, []);

  return null;
}