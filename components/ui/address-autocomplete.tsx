"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

export interface AddressResult {
  label: string;
  lat: number;
  lng: number;
}

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSelect: (result: AddressResult) => void;
  placeholder?: string;
}

/**
 * Adres-autocomplete via Nominatim (OpenStreetMap) -- gratis, geen API key
 * nodig. Debounced zoekopdracht, toont een dropdown met suggesties zodat
 * mensen geen niet-bestaand adres kunnen intypen, net als reguliere GPS-apps.
 */
export function AddressAutocomplete({ value, onChange, onSelect, placeholder }: Props) {
  const [results, setResults] = useState<AddressResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(value)}`,
          { headers: { Accept: "application/json" } }
        );
        const data = await res.json();
        setResults(
          (data ?? []).map((d: any) => {
            const a = d.address ?? {};
            const street = a.road ?? a.pedestrian ?? a.footway ?? "";
            const houseNumber = a.house_number ?? "";
            const postcode = a.postcode ?? "";
            const city = a.city ?? a.town ?? a.village ?? a.municipality ?? "";
            // Ons formaat: "straat nummer postcode stad" (spaties, geen land)
            const simple = [`${street} ${houseNumber}`.trim(), postcode, city]
              .filter(Boolean)
              .join(" ")
              .trim();
            return {
              label: simple || (d.display_name as string),
              lat: parseFloat(d.lat),
              lng: parseFloat(d.lon),
            };
          })
        );
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        placeholder={placeholder ?? "Adres"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        className="w-full bg-background p-3 text-sm rounded-xl outline-none"
        autoComplete="off"
      />
      {open && (loading || results.length > 0) && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-container-bg border border-border rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">Zoeken...</div>
          )}
          {!loading && results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onChange(r.label);
                onSelect(r);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 text-xs font-medium flex items-start gap-2 hover:bg-background transition-colors"
            >
              <MapPin size={13} className="shrink-0 mt-0.5 text-muted-foreground" />
              <span className="truncate">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}