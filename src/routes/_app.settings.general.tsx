import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { SectionCard } from "@/components/kocel/states";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { updateSettings } from "@/services/users";

export const Route = createFileRoute("/_app/settings/general")({
  component: GeneralSettings,
});

const timezones = ["UTC", "Europe/London", "Africa/Lagos", "Asia/Dubai", "America/New_York"];
const dateFormats = ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"];
const currencies = ["USD", "EUR", "GBP", "NGN"];

function GeneralSettings() {
  const { user, settings, refresh } = useAuth();

  const mutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) => updateSettings(user!.id, patch),
    onSuccess: () => {
      refresh();
      toast.success("Preferences saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows: { label: string; field: string; value: string; options: string[] }[] = [
    {
      label: "Timezone",
      field: "timezone",
      value: settings?.timezone ?? "UTC",
      options: timezones,
    },
    {
      label: "Date format",
      field: "date_format",
      value: settings?.date_format ?? "YYYY-MM-DD",
      options: dateFormats,
    },
    {
      label: "Display currency",
      field: "default_currency",
      value: settings?.default_currency ?? "USD",
      options: currencies,
    },
  ];

  return (
    <SectionCard title="General" description="Regional and display preferences.">
      <div className="max-w-xl space-y-4">
        {rows.map((row) => (
          <div key={row.field} className="space-y-1.5">
            <Label>{row.label}</Label>
            <Select
              value={row.value}
              onValueChange={(value) => mutation.mutate({ [row.field]: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {row.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Display currency affects Kocel formatting only — account currency is always reported by
          your broker.
        </p>
      </div>
    </SectionCard>
  );
}
