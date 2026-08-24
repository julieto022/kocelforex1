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
import { useConnections } from "@/lib/use-connections";
import { updateSettings } from "@/services/users";

export const Route = createFileRoute("/_app/settings/trading")({
  component: TradingSettings,
});

const riskProfiles = ["conservative", "balanced", "aggressive"];

function TradingSettings() {
  const { user, settings, refresh } = useAuth();
  const { connections } = useConnections();

  const mutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) => updateSettings(user!.id, patch),
    onSuccess: () => {
      refresh();
      toast.success("Trading preferences saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <SectionCard
      title="Trading preferences"
      description="Defaults Kocel uses when you create bots. Execution always happens on your MT5 terminal."
    >
      <div className="max-w-xl space-y-4">
        <div className="space-y-1.5">
          <Label>Default risk profile</Label>
          <Select
            value={settings?.default_risk_profile ?? "balanced"}
            onValueChange={(value) => mutation.mutate({ default_risk_profile: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {riskProfiles.map((profile) => (
                <SelectItem key={profile} value={profile}>
                  {profile}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Default MT5 account</Label>
          <Select
            value={settings?.active_connection_id ?? ""}
            onValueChange={(value) => mutation.mutate({ active_connection_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="No account selected" />
            </SelectTrigger>
            <SelectContent>
              {connections.map((connection) => (
                <SelectItem key={connection.id} value={connection.id}>
                  {connection.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </SectionCard>
  );
}
