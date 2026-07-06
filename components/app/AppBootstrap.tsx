"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store/app-store";

export default function AppBootstrap({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const bootstrap = useAppStore((s) => s.bootstrap);
  const bootstrapped = useAppStore((s) => s.bootstrapped);
  const loading = useAppStore((s) => s.loading);
  const userId = useAppStore((s) => s.userId);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (bootstrapped && !loading && !userId) {
      router.replace("/login");
    }
  }, [bootstrapped, loading, userId, router]);

  if (!bootstrapped || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-neutral-500">
        Loading Hangout...
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-neutral-500">
        Loading Hangout...
      </div>
    );
  }

  return <>{children}</>;
}