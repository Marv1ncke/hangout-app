import React from "react";
import { Metadata, Viewport } from "next";
import { ViewTransitions } from "next-view-transitions";
import NavigationLayout from "@/components/NavigationLayout";
import InstallBanner from "@/components/InstallBanner";
import AppBadgeRegistry from "@/components/AppBadgeRegistry";
import PushNotificationRegistry from "@/components/PushNotificationRegistry";
import AppRegistry from "@/components/AppRegistry"; // <-- RECHTSALEEF GEÏMPORTEERD
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
  return (
    <ViewTransitions>
      <AppRegistry /> {/* <-- BOEM! HIER ACTIVEERT HIJ NU DIRECT */}
      <html lang="en" className="antialiased">
        <body className="bg-neutral-50/50 text-neutral-900">
          <NavigationLayout>
            {children}
            <InstallBanner />
            <AppBadgeRegistry />
            <PushNotificationRegistry />
          </NavigationLayout>
        </body>
      </html>
    </ViewTransitions>
  );
}