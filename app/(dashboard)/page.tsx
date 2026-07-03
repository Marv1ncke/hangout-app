"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function RootPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // User is authenticated -> send them straight into the dashboard events calendar
        router.push("/events");
      } else {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      alert(error.message);
      setLoading(false);
    } else {
      router.push("/events");
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 text-sm text-neutral-500">
        Loading Hangout...
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Welcome to Hangout</h1>
          <p className="text-sm text-neutral-500 mt-1">Sign in to plan your next group plan.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Email address</label>
            <input
              type="email"
              required
              className="w-full rounded-xl border p-3 text-sm focus:outline-black"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Password</label>
            <input
              type="password"
              required
              className="w-full rounded-xl border p-3 text-sm focus:outline-black"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-black py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}