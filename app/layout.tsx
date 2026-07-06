import React from "react";
import { Metadata, Viewport } from "next";
import { ViewTransitions } from "next-view-transitions";
import NavigationLayout from "@/components/NavigationLayout";
import InstallBanner from "@/components/InstallBanner";
import AppBadgeRegistry from "@/components/AppBadgeRegistry";
import PushNotificationRegistry from "@/components/providers/PushNotificationRegistry";
import { AppProviders } from "../components/providers/AppProviders";
import AppRegistry from "../components/AppRegistry";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "Hangout",
  description: "Jouw hangout app",
  manifest: "/manifest.webmanifest", 
  appleWebApp: {
    capable: true,
    title: "Hangout",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewTransitions>
      {/* SuppressHydrationWarning voorkomt Next.js errors omdat we de class via JS injecteren in de <html> */}
      <html lang="en" className="antialiased" suppressHydrationWarning>
        <head>
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="Hangout" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <meta name="mobile-web-app-capable" content="yes" />

          {/* ⚡ THEMA PRE-LOAD SCRIPT */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var storedTheme = localStorage.getItem('app-theme') || 'system';
                    var isDark = storedTheme === 'dark' || (storedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                    if (isDark) {
                      document.documentElement.classList.add('dark');
                    } else {
                      document.documentElement.classList.add('light');
                    }
                  } catch (e) {}
                })();
              `,
            }}
          />
        </head>
        {/* ⚡ GEFIXT: bg-background/50 veranderd naar bg-background */}
        <body className="bg-background text-foreground overflow-x-hidden antialiased">
          <AppProviders>
          <ThemeListener />
            <AppRegistry />
            <NavigationLayout>
              {children}
              <InstallBanner />
              <AppBadgeRegistry />
              <PushNotificationRegistry />
            </NavigationLayout>
          </AppProviders>
        </body>
      </html>
    </ViewTransitions>
  );
}

"use client";
import { useEffect } from "react";

export function ThemeListener() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      if ((localStorage.getItem("app-theme") || "system") === "system") {
        document.documentElement.classList.toggle("dark", mq.matches);
        document.documentElement.classList.toggle("light", !mq.matches);
      }
    };
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return null;
}