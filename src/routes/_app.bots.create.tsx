import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import { createBot, validateBotInput } from "@/services/bots";
import { getStrategies } from "@/services/strategies";

export const Route = createFileRoute("/_app/bots/create")({
  component: CreateBotPage,
});

const riskProfiles = ["conservative", "balanced", "aggressive"];

function CreateBotPage() {
  const { user } = useAuth();
  const { connections, active } = useConnections();
  const navigate = useNavigate();

  const strategiesQuery = useQuery({ queryKey: ["strategies"], queryFn: getStrategies });

  const [form, setForm] = useState({
    name: "",
    symbol: "",
    riskProfile: "balanced",
    connectionId: active?.id ?? "",
    strategyId: "",
    timeframe: "",
  });

  const scalpingStrategies = useMemo(
    () =>
      (strategiesQuery.data ?? []).filter(
        (strategy) => strategy.category === "Scalping" && strategy.is_active,
      ),
    [strategiesQuery.data],
  );

  const selectedStrategy = scalpingStrategies.find((strategy) => strategy.id === form.strategyId) ?? null;
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createBot(user!.id, {
        name: form.name,
        symbol: form.symbol,
        riskProfile: form.riskProfile,
        brokerConnectionId: form.connectionId || null,
        strategyId: form.strategyId || null,
        timeframe: form.timeframe || null,
      }),
    onSuccess: () => {
      toast.success("Bot created successfully.");
      void navigate({ to: "/bots" });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Create New Bot"
        description="Create an automated bot using one of Kocel's predefined strategies."
        actions={
          <Button size="sm" variant="ghost" asChild>
            <Link to="/bots">
              <ArrowLeft className="mr-2 size-4" />
              Back to Bots
            </Link>
          </Button>
        }
      />

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
                placeholder="My Momentum Bot"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder="BTCUSD"
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

            {selectedStrategy && (
              <div className="rounded-md border border-border bg-muted/20 p-4">
                <h3 className="text-sm font-semibold text-foreground">{selectedStrategy.name}</h3>
                <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-foreground">Category:</span> {selectedStrategy.category}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Status:</span> {selectedStrategy.status ?? "Active"}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Supported Timeframes:</span>{" "}
                    {(selectedStrategy.timeframes ?? []).join(", ") || "N/A"}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Markets:</span>{" "}
                    {(selectedStrategy.markets ?? []).join(", ") || "N/A"}
                  </p>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{selectedStrategy.description}</p>
              </div>
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
                value={form.timeframe || selectedStrategy.timeframes?.[0] || ""}
                onValueChange={(value) => setForm({ ...form, timeframe: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a timeframe" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedStrategy.timeframes ?? ["M1", "M5", "M15"]).map((timeframe) => (
                    <SelectItem key={timeframe} value={timeframe}>
                      {timeframe}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending || strategiesQuery.isLoading}>
              {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create Bot
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
