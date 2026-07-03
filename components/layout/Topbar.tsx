import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function Topbar() {
  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      <div className="font-medium">Group Dashboard</div>

      <div className="flex items-center gap-3">
        <Button size="sm">New Hangout</Button>
        <Avatar />
      </div>
    </header>
  );
}