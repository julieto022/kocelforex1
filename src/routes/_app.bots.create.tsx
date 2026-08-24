import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/kocel/page-header";
import { SectionCard } from "@/components/kocel/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createBot } from "@/services/bots";
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
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createBot(user!.id, {
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        riskProfile: form.riskProfile,
        brokerConnectionId: form.connectionId || null,
        strategyId: form.strategyId || null,
      }),
    onSuccess: () => {
      toast.success("Bot created");
      void navigate({ to: "/bots" });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Create bot"
        description="Bots only trade once the assigned MT5 account is connected through the Kocel Bridge EA."
      />

      <SectionCard title="Bot configuration">
        <form
          className="max-w-xl space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (form.name.trim().length < 2 || form.symbol.trim().length < 2) {
              setError("Enter a bot name and a trading symbol.");
              return;
            }
            setError(null);
            mutation.mutate();
          }}
        >
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
              placeholder="EURUSD"
              value={form.symbol}
              onChange={(event) => setForm({ ...form, symbol: event.target.value })}
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">
              Use the exact symbol name your broker uses in MT5.
            </p>
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

          <div className="space-y-1.5">
            <Label>Strategy</Label>
            <Select
              value={form.strategyId}
              onValueChange={(value) => setForm({ ...form, strategyId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a strategy" />
              </SelectTrigger>
              <SelectContent>
                {(strategiesQuery.data ?? []).map((strategy) => (
                  <SelectItem key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create bot
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
