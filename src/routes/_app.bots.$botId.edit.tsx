import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/kocel/page-header";
import { SectionCard } from "@/components/kocel/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useConnections } from "@/lib/use-connections";
import { getBotById, updateBot, validateBotInput } from "@/services/bots";
import { getStrategies } from "@/services/strategies";

export const Route = createFileRoute("/_app/bots/$botId/edit")({
  component: EditBotPage,
});

const riskProfiles = ["CONSERVATIVE", "BALANCED", "AGGRESSIVE"];

function EditBotPage() {
  const { botId } = Route.useParams();
  const { user } = useAuth();
  const { connections } = useConnections();
  const navigate = useNavigate();

  const botQuery = useQuery({
    queryKey: ["bot", botId],
    queryFn: () => getBotById(botId),
    enabled: Boolean(user?.id),
  });

  const strategiesQuery = useQuery({
    queryKey: ["strategies"],
    queryFn: getStrategies,
    enabled: Boolean(user?.id),
  });

  const [form, setForm] = useState({
    name: "",
    symbol: "",
    riskProfile: "BALANCED",
    connectionId: "",
    strategyId: "",
    timeframe: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bot = botQuery.data;
    if (!bot) return;
    setForm({
      name: bot.name ?? "",
      symbol: bot.symbol ?? "",
      riskProfile: String(bot.risk_profile ?? "BALANCED").toUpperCase(),
      connectionId: bot.broker_connection_id ?? "",
      strategyId: bot.strategy_id ?? "",
      timeframe: bot.timeframe ?? "",
    });
  }, [botQuery.data]);

  const scalpingStrategies = useMemo(
    () => (strategiesQuery.data ?? []).filter((strategy) => strategy.category === "Scalping" && strategy.is_active),
    [strategiesQuery.data],
  );

  const selectedStrategy =
    scalpingStrategies.find((strategy) => strategy.id === form.strategyId) ??
    (strategiesQuery.data ?? []).find((strategy) => strategy.id === form.strategyId) ??
    null;

  const mutation = useMutation({
    mutationFn: () =>
      updateBot(botId, {
        name: form.name,
        symbol: form.symbol,
        strategyId: form.strategyId || null,
        brokerConnectionId: form.connectionId || null,
        riskProfile: form.riskProfile,
        timeframe: form.timeframe || null,
      }),
    onSuccess: () => {
      toast.success("Bot updated successfully.");
      void navigate({ to: "/bots" });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  if (botQuery.isLoading || !botQuery.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Edit bot" description="Loading bot details…" />
        <SectionCard title="Bot configuration">
          <p className="text-sm text-muted-foreground">Loading bot…</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Edit bot" description="Update the selected strategy, account and bot configuration." />

      <SectionCard title="Bot configuration">
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            const validation = validateBotInput({
              name: form.name,
              symbol: form.symbol,
              strategyId: form.strategyId,
              connectionId: form.connectionId,
            });
            if (!validation.ok) {
              setError(validation.message);
              return;
            }
            setError(null);
            mutation.mutate();
          }}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Bot name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                maxLength={80}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                value={form.symbol}
                onChange={(event) => setForm({ ...form, symbol: event.target.value })}
                maxLength={20}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Risk profile</Label>
            <Select
              value={form.riskProfile}
              onValueChange={(value) => setForm({ ...form, riskProfile: value })}
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

          <div className="space-y-3">
            <div>
              <Label className="text-base">Select Strategy</Label>
              <p className="text-sm text-muted-foreground">Choose one strategy for this bot.</p>
            </div>

            {strategiesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading strategies...</p>
            ) : scalpingStrategies.length === 0 ? (
              <p className="text-sm text-destructive">No active scalping strategies are available.</p>
            ) : (
              <RadioGroup
                value={form.strategyId}
                onValueChange={(value) => setForm({ ...form, strategyId: value })}
                className="grid gap-3"
              >
                {scalpingStrategies.map((strategy) => {
                  const isSelected = form.strategyId === strategy.id;
                  return (
                    <label
                      key={strategy.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition ${
                        isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                      }`}
                    >
                      <RadioGroupItem value={strategy.id} id={strategy.id} className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{strategy.name}</span>
                          {isSelected && <Check className="size-4 text-primary" />}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {strategy.short_description || strategy.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>MT5 account</Label>
            <Select
              value={form.connectionId}
              onValueChange={(value) => setForm({ ...form, connectionId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a connected account" />
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

          {selectedStrategy && (
            <div className="space-y-1.5">
              <Label>Timeframe</Label>
              <Select
                value={form.timeframe}
                onValueChange={(value) => setForm({ ...form, timeframe: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a timeframe" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedStrategy.timeframes ?? ["M1", "M5", "M15", "M30", "H1"]).map((timeframe) => (
                    <SelectItem key={timeframe} value={timeframe}>
                      {timeframe}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedStrategy && (
            <div className="rounded-md border border-border bg-muted/20 p-4">
              <h3 className="font-medium text-foreground">{selectedStrategy.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{selectedStrategy.description}</p>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save bot
            </Button>
            <Button type="button" variant="ghost" onClick={() => void navigate({ to: "/bots" })}>
              Cancel
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
