import { Calendar, Users, Clock, Settings } from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: Calendar },
  { label: "Availability", icon: Clock },
  { label: "Events", icon: Users },
  { label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r h-full p-4">
      <div className="font-bold text-lg mb-6">Hangout</div>

      <nav className="space-y-2">
        {navItems.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-neutral-100 cursor-pointer"
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </div>
        ))}
      </nav>
    </aside>
  );
}