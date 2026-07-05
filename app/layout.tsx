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
};

export const metadata: Metadata = {
  title: "Hangout",
  description: "Jouw hangout app",
  manifest: "public/manifest.webmanifest", // Zorg dat dit naar je PWA manifest verwijst
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kosten Pot",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewTransitions>
      <html lang="en" className="antialiased">
        <body className="bg-neutral-50/50 text-neutral-900">
          <AppProviders>
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