import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { SectionCard } from "@/components/kocel/states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { getRiskSettings, updateRiskSettings } from "@/lib/functions/risk.functions";

export const Route = createFileRoute("/_app/settings/trading")({
  component: TradingSettings,
});

const riskProfiles = ["CONSERVATIVE", "BALANCED", "AGGRESSIVE"];

function TradingSettings() {
  const { user, settings, refresh } = useAuth();
  const { connections } = useConnections();
  const [risk, setRisk] = useState({
    maxLotSize: "1",
    maxOpenPositions: "10",
    maxPositionsPerSymbol: "3",
    maxDailyLoss: "",
    maxDailyLossPercent: "",
    maxTradeRiskPercent: "",
    minimumFreeMargin: "0",
    maximumMarginUsagePercent: "80",
    requireStopLoss: false,
    manualTradingEnabled: true,
    emergencyStopEnabled: false,
  });
  const activeConnectionId = settings?.active_connection_id ?? connections[0]?.id ?? "";

  useEffect(() => {
    if (!activeConnectionId) return;
    void getRiskSettings({ data: { connectionId: activeConnectionId } }).then((data) => {
      if (!data) return;
      setRisk({
        maxLotSize: String(data.max_lot_size),
        maxOpenPositions: String(data.max_open_positions),
        maxPositionsPerSymbol: String(data.max_positions_per_symbol),
        maxDailyLoss: data.max_daily_loss == null ? "" : String(data.max_daily_loss),
        maxDailyLossPercent: data.max_daily_loss_percent == null ? "" : String(data.max_daily_loss_percent),
        maxTradeRiskPercent: data.max_trade_risk_percent == null ? "" : String(data.max_trade_risk_percent),
        minimumFreeMargin: String(data.minimum_free_margin),
        maximumMarginUsagePercent: String(data.maximum_margin_usage_percent),
        requireStopLoss: data.require_stop_loss,
        manualTradingEnabled: data.manual_trading_enabled,
        emergencyStopEnabled: data.emergency_stop_enabled,
      });
    });
  }, [activeConnectionId]);

  const riskMutation = useMutation({
    mutationFn: () =>
      updateRiskSettings({
        data: {
          connectionId: activeConnectionId,
          maxLotSize: Number(risk.maxLotSize),
          maxOpenPositions: Number(risk.maxOpenPositions),
          maxPositionsPerSymbol: Number(risk.maxPositionsPerSymbol),
          maxDailyLoss: risk.maxDailyLoss ? Number(risk.maxDailyLoss) : null,
          maxDailyLossPercent: risk.maxDailyLossPercent ? Number(risk.maxDailyLossPercent) : null,
          maxTradeRiskPercent: risk.maxTradeRiskPercent ? Number(risk.maxTradeRiskPercent) : null,
          minimumFreeMargin: Number(risk.minimumFreeMargin),
          maximumMarginUsagePercent: Number(risk.maximumMarginUsagePercent),
          requireStopLoss: risk.requireStopLoss,
          manualTradingEnabled: risk.manualTradingEnabled,
          emergencyStopEnabled: risk.emergencyStopEnabled,
        },
      }),
    onSuccess: () => toast.success("Risk settings saved"),
    onError: (error: Error) => toast.error(error.message),
  });

  const saveRiskSettings = () => {
    const requiredNumbers = [
      ["Maximum lot size", risk.maxLotSize],
      ["Maximum open positions", risk.maxOpenPositions],
      ["Maximum positions per symbol", risk.maxPositionsPerSymbol],
      ["Minimum free margin", risk.minimumFreeMargin],
      ["Maximum margin usage", risk.maximumMarginUsagePercent],
    ] as const;
    const invalidField = requiredNumbers.find(([, value]) => !Number.isFinite(Number(value)));
    if (invalidField) {
      toast.error(`${invalidField[0]} must be a valid number.`);
      return;
    }
    riskMutation.mutate();
  };

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
            value={settings?.default_risk_profile?.toUpperCase() ?? "BALANCED"}
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

        <div className="border-t pt-5">
          <h2 className="text-base font-semibold">Trading risk management</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Limits apply per selected MT5 connection. MT5 performs the final broker-specific validation.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ["Maximum lot size", "maxLotSize", "1.00"],
            ["Maximum open positions", "maxOpenPositions", "10"],
            ["Maximum positions per symbol", "maxPositionsPerSymbol", "3"],
            ["Maximum daily loss", "maxDailyLoss", "Disabled"],
            ["Maximum daily loss %", "maxDailyLossPercent", "Disabled"],
            ["Maximum trade risk %", "maxTradeRiskPercent", "Disabled"],
            ["Minimum free margin", "minimumFreeMargin", "0"],
            ["Maximum margin usage %", "maximumMarginUsagePercent", "80"],
          ] as const).map(([label, key, placeholder]) => (
            <div className="space-y-1.5" key={key}>
              <Label>{label}</Label>
              <Input
                value={risk[key]}
                placeholder={placeholder}
                inputMode="decimal"
                onChange={(event) => setRisk((current) => ({ ...current, [key]: event.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {([
            ["Require Stop Loss", "requireStopLoss"],
            ["Manual trading enabled", "manualTradingEnabled"],
            ["Emergency Stop", "emergencyStopEnabled"],
          ] as const).map(([label, key]) => (
            <div className="flex items-center justify-between rounded-md border p-3" key={key}>
              <Label>{label}</Label>
              <Switch checked={risk[key]} onCheckedChange={(checked) => setRisk((current) => ({ ...current, [key]: checked }))} />
            </div>
          ))}
        </div>
        <Button disabled={!activeConnectionId || riskMutation.isPending} onClick={saveRiskSettings}>
          {riskMutation.isPending ? "Saving..." : "Save risk settings"}
        </Button>
      </div>
    </SectionCard>
  );
}
