"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useTransitionRouter as useRouter } from "next-view-transitions";
import { supabase } from "@/lib/supabase/client";
import { Check, X, Loader2 } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";

type Status = "verifying" | "success" | "error";

function ConfirmResultInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    async function run() {
      const token_hash = searchParams.get("token_hash");
      const type = searchParams.get("type") as EmailOtpType | null;

      if (!token_hash || !type) {
        setStatus("error");
        setErrorText("Deze link is ongeldig of onvolledig.");
        return;
      }

      // Cruciaal: dit gebeurt via de browser-Supabase-client (localStorage),
      // zodat de sessie daadwerkelijk zichtbaar is voor de rest van de app.
      const { error } = await supabase.auth.verifyOtp({ type, token_hash });

      if (error) {
        setStatus("error");
        setErrorText("Deze link is ongeldig of verlopen. Vraag een nieuwe aan.");
        return;
      }

      setStatus("success");
      setTimeout(() => router.replace("/events"), 1800);
    }
    run();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-container-bg p-8 shadow-sm text-center">
        {status === "verifying" && (
          <>
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
              <Loader2 size={22} className="animate-spin text-neutral-500" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-foreground">Bevestigen...</h1>
            <p className="mt-1.5 text-sm text-neutral-500">Even geduld, we ronden je verificatie af.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check size={22} className="text-green-600" strokeWidth={2.5} />
            </div>
            <h1 className="text-xl font-black tracking-tight text-foreground">Account bevestigd!</h1>
            <p className="mt-1.5 text-sm text-neutral-500">Je wordt automatisch doorgestuurd naar je agenda...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <X size={22} className="text-red-600" strokeWidth={2.5} />
            </div>
            <h1 className="text-xl font-black tracking-tight text-foreground">Link ongeldig</h1>
            <p className="mt-1.5 text-sm text-neutral-500">{errorText}</p>
            <Link
              href="/login"
              className="mt-6 inline-block w-full rounded-xl bg-btn-bg text-btn-text px-4 py-3 text-sm font-bold active:scale-[0.98] transition-transform"
            >
              Terug naar inloggen
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function ConfirmResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Loader2 size={22} className="animate-spin text-neutral-500" />
        </div>
      }
    >
      <ConfirmResultInner />
    </Suspense>
  );
}