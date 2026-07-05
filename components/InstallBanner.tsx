/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import React, { useState, useEffect } from "react";
import { Share, PlusSquare } from "lucide-react";

export default function InstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check of het iOS is en NIET in standalone/app-modus draait
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
    
    if (isIOS && !isStandalone) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] bg-white border border-neutral-200 p-4 rounded-2xl shadow-xl flex flex-col gap-2 animate-in slide-in-from-bottom-5">
      <div className="flex justify-between items-start">
        <p className="text-xs font-bold text-neutral-800 pr-4">
          Installeer als app op je startscherm voor de beste ervaring:
        </p>
        <button onClick={() => setShow(false)} className="text-xs text-neutral-400 font-bold">Sluiten</button>
      </div>
      <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 flex-wrap font-medium">
        <span>Tik op</span>
        <Share size={14} className="text-blue-500 inline" />
        <span>en kies daarna</span>
        <span className="font-bold text-neutral-800 inline-flex items-center gap-0.5">
          <PlusSquare size={14} /> Zet op beginscherm
        </span>
      </div>
    </div>
  );
}