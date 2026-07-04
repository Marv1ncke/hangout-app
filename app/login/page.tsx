"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Mode = "login" | "register";

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
        router.push("/app");
      }
    }

    checkSession();
  }, [router]);

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
        router.push("/app");
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

    router.push("/app");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
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
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-black px-4 py-3 text-white font-medium disabled:opacity-60"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Log in"
              : "Create account"}
          </button>
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
            className="font-medium text-black underline underline-offset-2"
          >
            {mode === "login" ? "Register" : "Log in"}
          </button>
        </div>
      </div>
    </div>
  );
}