
import { Card } from "@/components/ui/card";

export function DashboardView() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className="p-4">
        <div className="text-sm text-neutral-500">Next Hangout</div>
        <div className="text-lg font-semibold mt-2">
          No event scheduled
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-sm text-neutral-500">Best Free Time</div>
        <div className="text-lg font-semibold mt-2">
          Thursday 19:00–22:00
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-sm text-neutral-500">Active Polls</div>
        <div className="text-lg font-semibold mt-2">
          1 open
        </div>
      </Card>
    </div>
  );
}