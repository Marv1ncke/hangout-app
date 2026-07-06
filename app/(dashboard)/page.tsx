"use client";

import React, { useEffect, useState } from "react";
import { Link, useTransitionRouter as useRouter } from "next-view-transitions";
import { supabase } from "@/lib/supabase/client";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default function RootPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuthGate() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Unauthenticated -> push flawlessly to your real login/register component
        router.replace("/login");
      } else {
        setLoading(false);
      }
    }
    checkAuthGate();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-neutral-500">
        Loading Hangout...
      </div>
    );
  }

  return <DashboardView />;
}