"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useModal } from "@/components/ui/useModal";

export function Topbar() {
  const { openModal } = useModal();

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      <div className="text-sm font-medium">Your Workspace</div>

      <Button size="sm" onClick={() => openModal()} className="gap-2">
  <Plus size={16} />
  New Hangout
</Button>
    </header>
  );
}