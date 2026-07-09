"use client";

import React from "react";
import { SWRConfig } from "swr";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Fetch mislukt (${res.status}): ${url}`);
    return res.json();
  });

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ fetcher }}>
      {children}
    </SWRConfig>
  );
}