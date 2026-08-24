import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { SectionCard } from "@/components/kocel/states";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { updateNotificationPreferences } from "@/services/users";
import type { NotificationPreferences } from "@/services/types";

export const Route = createFileRoute("/_app/settings/notifications")({
  component: NotificationSettings,
});

const options: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: "trade", label: "Trade alerts", description: "When positions open or close." },
  { key: "bot", label: "Bot alerts", description: "Bot start, stop and error events." },
  { key: "connection", label: "Connection alerts", description: "Bridge EA connection changes." },
  { key: "risk", label: "Risk alerts", description: "Margin and exposure warnings." },
  { key: "email", label: "Email notifications", description: "Send alerts to your email." },
  { key: "push", label: "Push notifications", description: "Send alerts to this device." },
];

const defaults: NotificationPreferences = {
  trade: true,
  bot: true,
  connection: true,
  risk: true,
  email: false,
  push: false,
};

function NotificationSettings() {
  const { user, settings, refresh } = useAuth();
  const current = { ...defaults, ...(settings?.notifications ?? {}) };

  const mutation = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      updateNotificationPreferences(user!.id, { ...current, ...patch }),
    onSuccess: () => {
      refresh();
      toast.success("Notification preferences saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <SectionCard title="Notifications" description="Choose which alerts Kocel sends you.">
      <ul className="divide-y divide-border">
        {options.map((option) => (
          <li key={option.key} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <Label htmlFor={option.key} className="text-sm">
                {option.label}
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
            </div>
            <Switch
              id={option.key}
              checked={Boolean(settings?.notifications?.[option.key])}
              disabled={mutation.isPending}
              onCheckedChange={(checked) => mutation.mutate({ [option.key]: checked })}
            />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
