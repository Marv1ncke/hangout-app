/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { Link, useTransitionRouter as useRouter } from "next-view-transitions";
import { supabase } from "@/lib/supabase/client";

type Mode = "login" | "register" | "forgot";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/events");
      }
    }
    checkSession();
  }, [router]);

  async function handleForgotPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    setLoading(false);
    if (error) {
      setErrorText(error.message);
    } else {
      setMessage("Check your inbox! We sent you a secure reset link.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");
    setMessage("");

    if (mode === "register") {
      if (!fullName.trim()) {
        setErrorText("Please enter your name.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        setErrorText(error.message);
        setLoading(false);
        return;
      }

      const userId = data.user?.id;

      if (userId) {
        await supabase.from("profiles").upsert({
          id: userId,
          full_name: fullName.trim(),
          avatar_url: "",
          updated_at: new Date().toISOString(),
        });
      }

      if (data.session) {
        router.replace("/events");
      } else {
        setMessage(
          "Account created. Check your email to confirm your account, then log in."
        );
        setMode("login");
      }

      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorText(error.message);
      setLoading(false);
      return;
    }

    router.replace("/events");
  }

  // --- RENDER FORGOT PASSWORD VIEW ---
  if (mode === "forgot") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border bg-container-bg p-6 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Reset your password</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Enter your email address and an email will be sent for you to reset your password.
            </p>
          </div>

          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                autoComplete="email"
                className="w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black/10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            {errorText && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorText}
              </div>
            )}

            {message && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {message}
              </div>
            )}

            {/* ⚡ AANGEPAST: GECORRIGEERDE DYNAMISCHE RESET KNOP */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-btn-bg text-btn-text text-xs font-black p-4 rounded-xl active:scale-98 transition-all hover:bg-neutral-900 mt-4 tracking-tight cursor-pointer text-center disabled:opacity-50"
            >
              {loading ? "Wacht even..." : "Wachtwoord herstellink sturen ✉️"}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-neutral-600">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorText("");
                setMessage("");
              }}
              className="font-medium text-foreground underline underline-offset-2"
            >
              Back to log in
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER STANDARD LOGIN / REGISTER VIEW ---
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-container-bg p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {mode === "login"
              ? "Log in to your shared hangout planner."
              : "Create an account for your friend group workspace."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <input
                className="w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black/10"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Markus"
                required={mode === "register"}
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              autoComplete="email"
              className="w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black/10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Password</label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setErrorText("");
                    setMessage("");
                  }}
                  className="text-xs text-neutral-500 hover:text-foreground underline underline-offset-2"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {errorText && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorText}
            </div>
          )}

          {message && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </div>
          )}

          {/* ⚡ AANGEPAST: DYNAMISCHE SUBMIT KNOPPEN VOLLEDIG ONDERAAN HET FORMULIER */}
          <div className="pt-2">
            {mode === "login" ? (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-btn-bg text-btn-text text-xs font-black p-4 rounded-xl active:scale-98 transition-all hover:bg-neutral-900 tracking-tight cursor-pointer text-center disabled:opacity-50"
              >
                {loading ? "Inloggen..." : "Inloggen in Hangout 🚀"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-btn-bg text-btn-text text-xs font-black p-4 rounded-xl active:scale-98 transition-all hover:bg-neutral-900 tracking-tight cursor-pointer text-center disabled:opacity-50"
              >
                {loading ? "Account aanmaken..." : "Account aanmaken & meedoen ✨"}
              </button>
            )}
          </div>
        </form>

        <div className="mt-5 text-center text-sm text-neutral-600">
          {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setErrorText("");
              setMessage("");
            }}
            className="font-medium text-foreground underline underline-offset-2"
          >
            {mode === "login" ? "Register" : "Log in"}
          </button>
        </div>
      </div>
    </div>
  );
}