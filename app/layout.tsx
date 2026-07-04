import React from "react";
import { Metadata, Viewport } from "next";
import NavigationLayout from "@/components/NavigationLayout";
import InstallBanner from "@/components/InstallBanner";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Kosten Pot | Hangout Planner",
  description: "A sleek workspace for your friend group.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kosten Pot",
  },
  icons: {
    apple: [
      { url: "/path/to/icon-152x152.png", sizes: "152x152" },
      { url: "/path/to/icon-192x192.png", sizes: "192x192" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  
  // Voegt de badge (het meldingen-bolletje) toe op het startscherm bij het laden van de app
  React.useEffect(() => {
    if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
      // Zet het getal op 3 (kun je later dynamisch maken via je database/state)
      navigator.setAppBadge(3).catch((err) => console.error("Badge error:", err));
    }
  }, []);

  return (
    <html lang="en" className="antialiased">
      <body className="bg-neutral-50/50 text-neutral-900">
        <NavigationLayout>
          {children}
          <InstallBanner />
        </NavigationLayout>
      </body>
    </html>
  );
}