"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Check, X, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; type: ToastType; message: string; sub?: string; leaving?: boolean };

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, sub?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <Check size={16} strokeWidth={2.5} />,
  error: <AlertTriangle size={16} strokeWidth={2.5} />,
  info: <Info size={16} strokeWidth={2.5} />,
};

const ACCENTS: Record<ToastType, string> = {
  success: "text-green-500",
  error: "text-red-500",
  info: "text-foreground",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "info", sub?: string) => {
    const id = idRef.current++;
    setToasts((prev) => [...prev, { id, type, message, sub }]);

    // Start de uitvlieg-animatie iets voor de echte verwijdering, zodat
    // de exit-transition (opacity/translate) kan afspelen i.p.v. abrupt
    // te verdwijnen.
    window.setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    }, 2600);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2950);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[999999] flex flex-col items-center gap-2 pointer-events-none w-full px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl max-w-sm w-full sm:w-auto",
              "backdrop-blur-xl bg-container-bg/70 border border-white/10 shadow-lg",
              "transition-all duration-300 ease-out",
              t.leaving
                ? "opacity-0 -translate-y-3 scale-95"
                : "opacity-100 translate-y-0 scale-100 animate-in fade-in-0 slide-in-from-top-4"
            )}
          >
            <span className={ACCENTS[t.type]}>{ICONS[t.type]}</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">{t.message}</p>
              {t.sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{t.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast moet binnen ToastProvider gebruikt worden");
  return ctx;
}