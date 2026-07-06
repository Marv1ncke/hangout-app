import React from "react";
import { Metadata, Viewport } from "next";
import { ViewTransitions } from "next-view-transitions";
import NavigationLayout from "@/components/NavigationLayout";
import InstallBanner from "@/components/InstallBanner";
import AppBadgeRegistry from "@/components/AppBadgeRegistry";
import PushNotificationRegistry from "@/components/providers/PushNotificationRegistry";
import { AppProviders } from "../components/providers/AppProviders";
import AppRegistry from "../components/AppRegistry";
import ThemeListener from "@/components/ThemeListener";
import "./globals.css";

// 📱 Forceert iOS om de app-schaal te locken en voorkomt dat gebruikers per ongeluk in-zoomen
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // Zorgt dat de app onder de notch/Dynamic Island doorloopt
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "Hangout",
  description: "Jouw hangout app",
  manifest: "/manifest.webmanifest", 
  appleWebApp: {
    capable: true, // HIERMEE BLIJF JE IN DE APP EN GA JE NIET NAAR SAFARI
    title: "Hangout", // Dwingt de app-naam af op het thuisscherm
    statusBarStyle: "black-translucent", // Naadloze zwarte statusbalk integratie
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewTransitions>
      <html lang="en" className="antialiased" suppressHydrationWarning>
        <head>
          {/* 🛑 DE HEILIGE DRIE-EENHEID VOOR MAXIMALE APPLE NATIVE VIBE */}
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="Hangout" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          
          {/* Voorkomt dat iOS links buiten de PWA opent in Safari */}
          <meta name="mobile-web-app-capable" content="yes" />

          {/* ⚡ THEMA PRE-LOAD SCRIPT (Voorkomt witte flits bij opstarten) */}
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