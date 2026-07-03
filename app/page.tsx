import { AppShell } from "@/components/layout/AppShell";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default function Home() {
  return (
    <AppShell>
      <DashboardView />
    </AppShell>
  );
}