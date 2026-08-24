import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Server, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  BridgeDownloadActions,
  BridgeExplainer,
  BridgeStepList,
  ConnectionCodeBlock,
} from "@/components/kocel/bridge-steps";
import { BridgeStatusBadge, StatusBadge } from "@/components/kocel/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useConnections } from "@/lib/use-connections";
import { cn } from "@/lib/utils";
import { brokerStatusLabel, getBrokerList } from "@/services/brokers";
import { createMT5Connection } from "@/services/mt5";
import { createNotification } from "@/services/notifications";
import { BRIDGE_STATUS_MODEL, type Broker, type BrokerConnection } from "@/services/types";

type Step = 1 | 2 | 3;

export function ConnectWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { setActiveId } = useConnections();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>(1);
  const [broker, setBroker] = useState<Broker | null>(null);
  const [created, setCreated] = useState<BrokerConnection | null>(null);
  const [form, setForm] = useState({
    accountName: "",
    mt5Login: "",
    server: "",
    accountType: "standard",
    environment: "demo" as "demo" | "real",
    nickname: "",
  });

  const brokersQuery = useQuery({ queryKey: ["brokers"], queryFn: getBrokerList });

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !broker) throw new Error("Missing broker");
      const connection = await createMT5Connection(user.id, {
        brokerId: broker.id,
        accountName: form.accountName.trim(),
        mt5Login: form.mt5Login.trim(),
        server: form.server.trim(),
        accountType: form.accountType,
        environment: form.environment,
        nickname: form.nickname.trim() || undefined,
      });
      await createNotification(user.id, {
        type: "account_connected",
        title: `${broker.name} setup started`,
        message: `Waiting for the Kocel Bridge EA on account ${connection.mt5_login}.`,
      });
      return connection;
    },
    onSuccess: (connection) => {
      setCreated(connection);
      setActiveId(connection.id);
      void queryClient.invalidateQueries({ queryKey: ["connections", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      setStep(3);
    },
    onError: (error: Error) => toast.error(error.message || "Could not create the connection"),
  });

  function reset() {
    setStep(1);
    setBroker(null);
    setCreated(null);
    setForm({
      accountName: "",
      mt5Login: "",
      server: "",
      accountType: "standard",
      environment: "demo",
      nickname: "",
    });
  }

  const formValid =
    form.accountName.trim().length > 1 &&
    /^[0-9]{4,15}$/.test(form.mt5Login.trim()) &&
    form.server.trim().length > 2;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Select broker"}
            {step === 2 && "MT5 account details"}
            {step === 3 && "Connect the Kocel Bridge EA"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Kocel is broker-independent. Choose the MT5 broker you trade with."}
            {step === 2 && "These details identify the account. Never enter your broker password."}
            {step === 3 && "Enter this code in the Bridge EA inside your MT5 terminal."}
          </DialogDescription>
        </DialogHeader>

        <ol className="flex items-center gap-2 text-[0.68rem] font-medium text-muted-foreground">
          {["Broker", "Account", "Bridge"].map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[0.62rem]",
                  step > index
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              {label}
              {index < 2 && <span className="h-px w-4 bg-border" />}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <div className="space-y-2">
            {brokersQuery.isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : (
              (brokersQuery.data ?? []).map((option) => {
                const selectable = option.status === "supported" || option.status === "manual";
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={!selectable}
                    onClick={() => {
                      setBroker(option);
                      setStep(2);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-3 text-left transition-colors",
                      selectable ? "hover:border-primary/50 hover:bg-accent/40" : "opacity-60",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">
                        {option.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.capabilities.length > 0
                          ? option.capabilities.slice(0, 4).join(" · ")
                          : "Additional MT5 brokers are being added."}
                      </span>
                    </span>
                    <StatusBadge
                      tone={option.status === "supported" ? "success" : "neutral"}
                      size="sm"
                    >
                      {brokerStatusLabel(option)}
                    </StatusBadge>
                  </button>
                );
              })
            )}
          </div>
        )}

        {step === 2 && broker && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (formValid) create.mutate();
            }}
          >
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Broker: <span className="font-medium text-foreground">{broker.name}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="accountName">Account name</Label>
                <Input
                  id="accountName"
                  required
                  maxLength={60}
                  placeholder="Main real account"
                  value={form.accountName}
                  onChange={(event) => setForm({ ...form, accountName: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mt5Login">MT5 login / account number</Label>
                <Input
                  id="mt5Login"
                  required
                  inputMode="numeric"
                  maxLength={15}
                  placeholder="12345678"
                  className="num"
                  value={form.mt5Login}
                  onChange={(event) =>
                    setForm({ ...form, mt5Login: event.target.value.replace(/\D/g, "") })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="server">Server</Label>
                <Input
                  id="server"
                  required
                  maxLength={60}
                  placeholder={
                    (broker.connection_config as { server_hint?: string })?.server_hint ??
                    "Broker-MT5"
                  }
                  value={form.server}
                  onChange={(event) => setForm({ ...form, server: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accountType">Account type</Label>
                <Select
                  value={form.accountType}
                  onValueChange={(value) => setForm({ ...form, accountType: value })}
                >
                  <SelectTrigger id="accountType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="raw">Raw / ECN</SelectItem>
                    <SelectItem value="cent">Cent</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="environment">Environment</Label>
                <Select
                  value={form.environment}
                  onValueChange={(value) =>
                    setForm({ ...form, environment: value as "demo" | "real" })
                  }
                >
                  <SelectTrigger id="environment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demo">Demo</SelectItem>
                    <SelectItem value="real">Real</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nickname">Label (optional)</Label>
                <Input
                  id="nickname"
                  maxLength={40}
                  placeholder="Swing account"
                  value={form.nickname}
                  onChange={(event) => setForm({ ...form, nickname: event.target.value })}
                />
              </div>
            </div>

            <p className="flex items-start gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-foreground/80">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-info" />
              Kocel never asks for your broker trading password. Your credentials stay inside your
              MT5 terminal and Kocel communicates through the Bridge EA.
            </p>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="submit" disabled={!formValid || create.isPending}>
                {create.isPending && <Loader2 className="size-4 animate-spin" />}
                Generate connection code
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === 3 && created && (
          <div className="space-y-4">
            <ConnectionCodeBlock code={created.connection_code} />
            <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Server className="size-3.5" />
                {BRIDGE_STATUS_MODEL[created.status].explanation}
              </span>
              <BridgeStatusBadge status={created.status} size="sm" />
            </div>
            <BridgeExplainer />
            <BridgeStepList />
            <BridgeDownloadActions />
            <DialogFooter>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  reset();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
