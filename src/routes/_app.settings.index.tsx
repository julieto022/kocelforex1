import { Link, createFileRoute } from "@tanstack/react-router";

import { settingsNav } from "@/components/kocel/nav-config";
import { SectionCard } from "@/components/kocel/states";

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsIndex,
});

const descriptions: Record<string, string> = {
  "/settings/profile": "Your name, username and contact details.",
  "/settings/security": "Password and Kocel account security.",
  "/settings/mt5": "Connected MT5 broker accounts and Bridge status.",
  "/settings/notifications": "Which alerts Kocel sends you.",
  "/settings/appearance": "Theme and display preferences.",
  "/settings/trading": "Default risk profile and trading defaults.",
  "/settings/general": "Timezone, language and formatting.",
};

function SettingsIndex() {
  return (
    <SectionCard title="All settings" bodyClassName="p-0 sm:p-0">
      <ul className="divide-y divide-border">
        {settingsNav.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="block px-4 py-3 transition-colors hover:bg-muted/50">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{descriptions[item.to]}</p>
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
