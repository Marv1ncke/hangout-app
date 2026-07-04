import React from "react";
import NavigationLayout from "@/components/NavigationLayout";
import "./globals.css"; // Fixed: relative path to the local app folder
export const metadata = {
  title: "Hangout Planner",
  description: "A sleek workspace for your friend group.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="antialiased">
      <body className="bg-neutral-50/50 text-neutral-900">
        <NavigationLayout>{children}</NavigationLayout>
      </body>
    </html>
  );
}