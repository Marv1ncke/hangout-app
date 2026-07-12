"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Share, SquarePlus, Smartphone, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Platform / versie detectie — 100% client-side, geen backend-calls
// ============================================================

type Platform = "ios-safari" | "ios-other" | "android" | "desktop" | "standalone";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "desktop";

  const standalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  if (standalone) return "standalone";

  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
  const isAndroid = /Android/.test(ua);

  if (isIOS) {
    // Safari op iOS heeft geen "CriOS"/"FxiOS"/"EdgiOS" in de UA. Andere
    // browsers op iOS (Chrome/Firefox/Edge) kunnen niet (of nauwelijks)
    // PWA's installeren via dezelfde flow.
    const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isOtherBrowser ? "ios-other" : "ios-safari";
  }
  if (isAndroid) return "android";
  return "desktop";
}

function getIOSMajorVersion(): number | null {
  if (typeof window === "undefined") return null;
  const match = window.navigator.userAgent.match(/OS (\d+)_(\d+)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

// ============================================================
// Instructie-varianten per iOS-versie — klein config-object, makkelijk
// aan te passen zonder JSX te herschrijven als Apple de flow wijzigt.
// ============================================================

type Step = { icon: React.ReactNode; text: string };

function getIOSSteps(version: number | null): Step[] {
  // iOS 18+: extra tussenmenu voor "Add to Home Screen" verschijnt.
  if (version !== null && version >= 18) {
    return [
      { icon: <Share size={18} />, text: "Tik op het deel-icoon onderin Safari" },
      { icon: <ChevronDown size={18} />, text: "Scroll naar beneden en tik op 'Meer'" },
      { icon: <SquarePlus size={18} />, text: "Tik op 'Zet op beginscherm'" },
    ];
  }
  // iOS 16-17 en iOS <=15: zelfde korte flow (1 scroll-stap).
  return [
    { icon: <Share size={18} />, text: "Tik op het deel-icoon onderin Safari" },
    { icon: <SquarePlus size={18} />, text: "Scroll naar beneden en tik op 'Zet op beginscherm'" },
  ];
}

const ANDROID_STEPS: Step[] = [
  { icon: <Smartphone size={18} />, text: "Tik op het menu (⋮) rechtsboven in Chrome" },
  { icon: <SquarePlus size={18} />, text: "Tik op 'App installeren' of 'Toevoegen aan startscherm'" },
];

// ============================================================
// Persistentie — enkel localStorage, geen Supabase
// ============================================================

const STORAGE_KEY = "hangout_install_prompt_dismissed";
const RESURFACE_AFTER_DAYS = 7;

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { timestamp } = JSON.parse(raw);
    const daysSince = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
    return daysSince < RESURFACE_AFTER_DAYS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now() }));
  } catch {
    /* localStorage niet beschikbaar: negeer stil, geen crash */
  }
}

// ============================================================
// Component
// ============================================================

export function InstallPrompt({ forceOpen, onClose }: { forceOpen?: boolean; onClose?: () => void }) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [iosVersion, setIosVersion] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [showAllVariants, setShowAllVariants] = useState(false);
  const [androidPromptEvent, setAndroidPromptEvent] = useState<any>(null);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    setIosVersion(getIOSMajorVersion());

    if (p === "standalone" || p === "desktop") {
      setVisible(false);
      return;
    }
    if (forceOpen) {
      setVisible(true);
      return;
    }
    setVisible(!wasDismissedRecently());
  }, [forceOpen]);

  // Android: vang het native install-prompt-event op zodat we een
  // "Installeer app"-knop kunnen tonen die 1 tap doet i.p.v. handmatige stappen.
  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setAndroidPromptEvent(e);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    markDismissed();
    onClose?.();
  }, [onClose]);

  const handleAndroidInstall = useCallback(async () => {
    if (!androidPromptEvent) return;
    androidPromptEvent.prompt();
    await androidPromptEvent.userChoice;
    setAndroidPromptEvent(null);
    handleClose();
  }, [androidPromptEvent, handleClose]);

  if (!visible || !platform || platform === "standalone" || platform === "desktop") return null;

  const isIOS = platform === "ios-safari" || platform === "ios-other";
  const steps = isIOS ? getIOSSteps(iosVersion) : ANDROID_STEPS;
  const unrecognized = platform === "ios-other" || (isIOS && iosVersion === null);

  return (
    <div className="rounded-2xl border border-border bg-container-bg p-5 space-y-4">
      <button
        onClick={handleClose}
        className="absolute right-4 top-4 text-muted-foreground active:opacity-60"
        aria-label="Sluiten"
        style={{ position: "relative", float: "right", marginTop: "-4px" }}
      >
        <X size={18} />
      </button>

      <div className="space-y-1">
        <h3 className="font-black text-base tracking-tight">Zet Hangout op je beginscherm</h3>
        <p className="text-xs text-muted-foreground">
          Sneller openen, volledig scherm, voelt als een echte app — geen adresbalk.
        </p>
      </div>

      {/* Visuele vergelijking: browser vs standalone */}
      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-xl border border-border bg-background p-2 text-center space-y-1">
          <div className="h-10 rounded-md bg-neutral-200/60 dark:bg-white/10 flex items-center px-1.5 gap-1">
            <div className="size-1.5 rounded-full bg-neutral-400" />
            <div className="flex-1 h-2 rounded bg-neutral-300 dark:bg-white/20" />
          </div>
          <p className="text-[10px] font-bold text-muted-foreground">Nu (browser)</p>
        </div>
        <div className="text-muted-foreground text-xs font-bold">→</div>
        <div className="flex-1 rounded-xl border border-border bg-background p-2 text-center space-y-1">
          <div className="h-10 rounded-md bg-btn-bg/90 flex items-center justify-center">
            <SquarePlus size={16} className="text-btn-text" />
          </div>
          <p className="text-[10px] font-bold text-muted-foreground">Straks (app-icoon)</p>
        </div>
      </div>

      {/* Android: 1-tap install indien beschikbaar */}
      {platform === "android" && androidPromptEvent && (
        <button
          onClick={handleAndroidInstall}
          className="w-full py-2.5 rounded-xl text-sm font-bold bg-btn-bg text-btn-text active:scale-95 transition-transform"
        >
          App installeren
        </button>
      )}

      {/* Handmatige stappen (iOS altijd, Android als fallback zonder native prompt) */}
      {(isIOS || !androidPromptEvent) && !unrecognized && (
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-2.5 text-xs font-medium">
              <span className="shrink-0 size-6 rounded-full bg-background border border-border flex items-center justify-center text-foreground">
                {step.icon}
              </span>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Fallback voor onherkende UA / niet-Safari iOS-browsers */}
      {unrecognized && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {platform === "ios-other"
              ? "Open Hangout in Safari om te installeren — andere browsers op iOS ondersteunen dit niet altijd."
              : "We konden je exacte iOS-versie niet herkennen."}
          </p>
          <button
            onClick={() => setShowAllVariants((v) => !v)}
            className="text-xs font-bold text-primary underline decoration-primary/30 underline-offset-2"
          >
            Ik zie dit niet op mijn scherm →
          </button>
          {showAllVariants && (
            <div className="space-y-3 pt-1">
              {[15, 17, 18].map((v) => (
                <div key={v} className="space-y-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">iOS {v}{v === 18 ? "+" : ""}</p>
                  <ol className="space-y-1.5">
                    {getIOSSteps(v).map((step, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs font-medium">
                        <span className="shrink-0 size-5 rounded-full bg-background border border-border flex items-center justify-center text-foreground">
                          {step.icon}
                        </span>
                        <span>{step.text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleClose}
        className="w-full py-2 rounded-xl text-xs font-bold text-muted-foreground active:opacity-60"
      >
        Later
      </button>
    </div>
  );
}

// ============================================================
// Kleine persistente pill/knop om de instructies opnieuw te openen
// (bv. in profiel-pagina), zoals de spec vereist.
// ============================================================

export function InstallPromptReopenButton({ compact }: { compact?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  if (!platform || platform === "standalone" || platform === "desktop") return null;

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Installeer als app"
          className="p-2 rounded-full text-foreground active:scale-90 transition-transform"
        >
          <Smartphone size={18} />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-72 z-50 animate-in fade-in-0 slide-in-from-top-1 duration-150">
            <InstallPrompt forceOpen onClose={() => setOpen(false)} />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-bold px-3 py-2 rounded-xl bg-background border border-border text-foreground active:scale-95 transition-transform flex items-center gap-1.5"
      >
        <Smartphone size={14} /> Installeer als app
      </button>
      {open && (
        <div className="mt-3">
          <InstallPrompt forceOpen onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}