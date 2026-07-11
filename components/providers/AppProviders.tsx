// components/providers/AppProviders.tsx
"use client";

import React from "react";
import { SWRConfig } from "swr";
import { supabase } from "@/lib/supabase/client";

const fetcher = async (url: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(url, {
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {},
  });
  if (!res.ok) throw new Error(`Fetch mislukt (${res.status}): ${url}`);
  return res.json();
};

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig 
      value={{ 
        fetcher,
        revalidateOnFocus: false, // Voorkom herladen bij focus/klik wissels
        revalidateOnReconnect: false 
      }}
    >
      {children}
    </SWRConfig>
  );
}