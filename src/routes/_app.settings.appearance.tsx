import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Moon, Sun } from "lucide-react";

import { SectionCard } from "@/components/kocel/states";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/_app/settings/appearance")({
  component: AppearanceSettings,
});

const modes = [
  { id: "light" as const, label: "Light", icon: Sun },
  { id: "dark" as const, label: "Dark", icon: Moon },
  { id: "system" as const, label: "System", icon: Monitor },
];

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <SectionCard title="Appearance" description="Choose how Kocel looks on this device.">
      <div className="grid gap-3 sm:grid-cols-3">
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setTheme(mode.id)}
            className={cn(
              "flex items-center gap-3 rounded-md border border-border p-3 text-left transition-colors hover:bg-muted/50",
              theme === mode.id && "border-primary/50 bg-primary/10",
            )}
          >
            <mode.icon className={cn("size-4", theme === mode.id && "text-primary")} />
            <span className="text-sm font-medium text-foreground">{mode.label}</span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
