"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isValidSession, setIsValidSession] = useState(true);

  // Guard: Verify they have an authenticated recovery token session active
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsValidSession(false);
        setErrorText("Your recovery link is invalid or has expired. Please request a new link.");
      }
    }
    checkSession();
  }, []);

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setErrorText("");
    setSuccessMessage("");

    if (password.length < 6) {
      setErrorText("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorText("Passwords do not match.");
      return;
    }

    setLoading(true);

    // Updates the password string profile for the active session account holder securely
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setErrorText(error.message);
    } else {
      setSuccessMessage("Your password was updated successfully! Redirecting you to sign in...");
      setTimeout(() => {
        router.replace("/login");
      }, 2500);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-container-bg p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Please enter and confirm your secure new account credentials.
          </p>
        </div>

        {errorText && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorText}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        {isValidSession && (
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <input
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <input
                type="password"
                placeholder="Re-type password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black px-4 py-3 text-white font-medium disabled:opacity-60"
            >
              {loading ? "Updating account..." : "Update Password"}
            </button>
          </form>
        )}

        {!isValidSession && (
          <button
            onClick={() => router.replace("/login")}
            className="w-full mt-2 rounded-xl bg-neutral-100 px-4 py-3 text-foreground font-medium hover:bg-neutral-200"
          >
            Return to Log In
          </button>
        )}
      </div>
    </div>
  );
}