import { Link, Outlet, createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/kocel/page-header";
import { settingsNav } from "@/components/kocel/nav-config";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Manage your Kocel account, brokers and preferences."
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {settingsNav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:border-primary/40 data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
          >
            {item.label}
          </Link>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
