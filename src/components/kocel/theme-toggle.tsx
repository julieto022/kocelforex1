import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme, type ThemePreference } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, resolved, setTheme } = useTheme();

  const next: ThemePreference = resolved === "dark" ? "light" : "dark";
  const Icon = theme === "system" ? Monitor : resolved === "dark" ? Moon : Sun;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${next} theme`}
      title={`Theme: ${theme}`}
      onClick={() => setTheme(next)}
    >
      <Icon className="size-4" />
    </Button>
  );
}
