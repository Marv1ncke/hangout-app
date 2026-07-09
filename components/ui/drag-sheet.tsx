"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DragSheet — herbruikbare bottom-sheet met:
 * - sleep-naar-onder om te sluiten (touch + mouse)
 * - achtergrond-blur/verduistering die 1-op-1 gekoppeld is aan de sleeppositie
 *   (niet los geanimeerd — dezelfde voortgang, dus altijd synchroon)
 * - kruisje rechtsboven dat smooth dezelfde close-animatie triggert als slepen
 * - scroll-lock op de pagina erachter terwijl de sheet open is
 * - snap-back naar boven als je niet ver genoeg sleept
 *
 * Gebruik dit voor ELKE sheet/modal in de app (ledenlijst, event aanmaken, ...)
 * zodat alle pop-ups exact hetzelfde aanvoelen.
 */

const CLOSE_DURATION = 480; // ms, moet matchen met de transition hieronder
const DISMISS_THRESHOLD = 0.35; // sleep verder dan 35% van sheet-hoogte = sluiten

interface DragSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  /** top-offset zodat de navbar er altijd bovenop blijft, bv. "calc(64px + env(safe-area-inset-top))" */
  topOffset?: string;
  /** bottom-offset zodat de sheet boven de bottom-navbar stopt */
  bottomOffset?: string;
}

export function DragSheet({
  open,
  onClose,
  children,
  title,
  subtitle,
  className,
  topOffset,
  bottomOffset = "0px",
}: DragSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [dragOffset, setDragOffset] = useState(0); // px, 0 = volledig open
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const sheetHeight = useRef(1);

  // mount/unmount + scroll-lock
  useEffect(() => {
    if (open) {
      setMounted(true);
      setIsClosing(false);
      setDragOffset(0);
      setIsOpening(true);
      // volgende frame: schakel isOpening uit zodat de transition van
      // "volledig onderaan" naar "volledig open" daadwerkelijk speelt
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpening(false));
      });
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
      (document.body as any)._scrollY = scrollY;
    } else if (mounted) {
      // animeer dicht, dan pas unmounten
      setIsClosing(true);
      const t = setTimeout(() => {
        setMounted(false);
        setIsClosing(false);
        setDragOffset(0);
      }, CLOSE_DURATION);
      const storedY = (document.body as any)._scrollY ?? 0;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      window.scrollTo(0, storedY);
      return () => clearTimeout(t);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const startDrag = useCallback((clientY: number) => {
    if (!sheetRef.current) return;
    dragStartY.current = clientY;
    sheetHeight.current = sheetRef.current.getBoundingClientRect().height || 1;
    setIsDragging(true);
  }, []);

  const moveDrag = useCallback((clientY: number) => {
    if (dragStartY.current === null) return;
    const delta = clientY - dragStartY.current;
    setDragOffset(Math.max(0, delta));
  }, []);

  const endDrag = useCallback(() => {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    setIsDragging(false);

    const progress = dragOffset / sheetHeight.current;
    if (progress > DISMISS_THRESHOLD) {
      onClose();
    } else {
      // snap terug naar boven
      setDragOffset(0);
    }
  }, [dragOffset, onClose]);

  if (!mounted) return null;

  // voortgang 0 (volledig open) -> 1 (volledig weg), voor drag, sluiten
  // via kruisje, én de initiele open-animatie (van onder naar boven)
  const progress = isClosing || isOpening
    ? 1
    : Math.min(1, dragOffset / sheetHeight.current);

  const translateY = isClosing || isOpening
    ? "100%"
    : `${dragOffset}px`;

  const backdropOpacity = 1 - progress;
  const blurPx = 24 * (1 - progress);

  return (
    <div className="fixed inset-0" style={{ zIndex: 90000 }}>
      {/* backdrop: opacity + blur gekoppeld aan dezelfde voortgang als de sheet */}
      <button
        aria-label="Sluiten"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/20"
        style={{
          opacity: backdropOpacity,
          backdropFilter: `blur(${blurPx}px)`,
          WebkitBackdropFilter: `blur(${blurPx}px)`,
          transition: isDragging ? "none" : `opacity ${CLOSE_DURATION}ms cubic-bezier(0.32,0.72,0,1), backdrop-filter ${CLOSE_DURATION}ms cubic-bezier(0.32,0.72,0,1)`,
        }}
      />

      <div
        ref={sheetRef}
        className={cn(
          "absolute left-0 right-0 bg-container-bg rounded-t-3xl border-t border-border shadow-2xl flex flex-col overflow-hidden",
          className
        )}
        style={{
          top: topOffset,
          bottom: bottomOffset,
          transform: `translateY(${translateY})`,
          transition: isDragging
            ? "none"
            : `transform ${CLOSE_DURATION}ms cubic-bezier(0.32,0.72,0,1)`,
        }}
      >
        {/* sleep-handvat + header, dit stuk vangt de drag-gesture op */}
        <div
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={(e) => startDrag(e.touches[0].clientY)}
          onTouchMove={(e) => moveDrag(e.touches[0].clientY)}
          onTouchEnd={endDrag}
          onMouseDown={(e) => {
            startDrag(e.clientY);
            const onMove = (ev: MouseEvent) => moveDrag(ev.clientY);
            const onUp = () => {
              endDrag();
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
        >
          <div className="w-9 h-1 bg-border rounded-full mx-auto mt-2.5 mb-1" />

          {(title || subtitle) && (
            <div className="px-6 pt-2.5 pb-4 border-b border-border flex items-center justify-between bg-container-bg">
              <div className="min-w-0">
                {title && (
                  <h2 className="text-xl font-black text-foreground tracking-tight truncate">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-xs font-bold text-neutral-400 mt-1">{subtitle}</p>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Sluiten"
                className="w-9 h-9 flex items-center justify-center bg-neutral-100 text-neutral-800 rounded-full shrink-0 ml-3 active:scale-90 transition-transform"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
