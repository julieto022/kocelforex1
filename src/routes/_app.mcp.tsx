import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CircleCheck,
  CircleX,
  Copy,
  KeyRound,
  Loader2,
  PlugZap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/kocel/page-header";
import { EmptyState, SectionCard } from "@/components/kocel/states";
import {
  createMcpApiKey,
  getMcpApiKeys,
  getMcpTradeRequests,
  reviewMcpTradeRequest,
  revokeMcpApiKey,
} from "@/lib/functions/mcp.functions";
import { useConnections } from "@/lib/use-connections";

const MCP_ENDPOINT = "https://kocelforex1.vercel.app/api/mcp";
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

type McpApiKey = {
  id: string;
  name: string;
  connection_id: string;
  token_hint: string;
  can_trade_directly: boolean;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type McpTradeRequest = {
  id: string;
  connection_id: string;
  payload: {
    operation: string;
    symbol?: string | undefined;
    side?: string | undefined;
    volume?: number | undefined;
    stopLoss?: number | undefined;
    takeProfit?: number | undefined;
    positionTicket?: number | undefined;
    orderTicket?: number | undefined;
  };
  status: string;
  command_id: string | null;
  decision_reason: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_app/mcp")({
  component: McpPage,
});

function isRecentlyActive(lastUsedAt: string | null): boolean {
  if (!lastUsedAt) return false;
  const age = Date.now() - Date.parse(lastUsedAt);
  return age >= 0 && age < ACTIVE_WINDOW_MS;
}

function proposalSummary(payload: McpTradeRequest["payload"]): string {
  switch (payload.operation) {
    case "OPEN_MARKET":
      return `${payload.side ?? "—"} ${payload.volume ?? "—"} ${payload.symbol ?? ""}`.trim();
    case "CLOSE_POSITION":
      return `Close position #${payload.positionTicket ?? "—"}`;
    case "PARTIAL_CLOSE":
      return `Partially close ${payload.volume ?? "—"} lots of #${payload.positionTicket ?? "—"}`;
    case "MODIFY_POSITION":
      return `Modify position #${payload.positionTicket ?? "—"} (SL ${payload.stopLoss ?? "unchanged"}, TP ${payload.takeProfit ?? "unchanged"})`;
    case "MOVE_TO_BREAK_EVEN":
      return `Move position #${payload.positionTicket ?? "—"} to break even`;
    case "CANCEL_PENDING_ORDER":
      return `Cancel pending order #${payload.orderTicket ?? "—"}`;
    default:
      return payload.operation;
  }
}

function statusLabel(status: string): string {
  if (status === "PENDING_APPROVAL") return "Waiting for your approval";
  if (status === "APPROVING") return "Submitting to MT5";
  if (status === "APPROVED") return "Approved and submitted";
  if (status === "REJECTED") return "Rejected";
  if (status === "FAILED") return "Not submitted";
  return status;
}

function McpPage() {
  const queryClient = useQueryClient();
  const { active, connections } = useConnections();
  const [keyName, setKeyName] = useState("My AI assistant");
  const [canTradeDirectly, setCanTradeDirectly] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [proposalToApprove, setProposalToApprove] = useState<McpTradeRequest | null>(null);

  const keysQuery = useQuery({
    queryKey: ["mcp-api-keys"],
    queryFn: () => getMcpApiKeys(),
    refetchInterval: 10_000,
  });
  const requestsQuery = useQuery({
    queryKey: ["mcp-trade-requests"],
    queryFn: () => getMcpTradeRequests(),
    refetchInterval: 5_000,
  });

  const refreshMcp = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mcp-api-keys"] }),
      queryClient.invalidateQueries({ queryKey: ["mcp-trade-requests"] }),
    ]);
  };

  const createKey = useMutation({
    mutationFn: () => {
      if (!active) throw new Error("Connect an MT5 account before creating an MCP key.");
      return createMcpApiKey({
        data: { connectionId: active.id, name: keyName, canTradeDirectly },
      });
    },
    onSuccess: async (result) => {
      setCreatedToken(result.token);
      toast.success("MCP key created. Copy it now; it will only be shown once.");
      await refreshMcp();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revokeKey = useMutation({
    mutationFn: (keyId: string) => revokeMcpApiKey({ data: { keyId } }),
    onSuccess: async () => {
      toast.success("MCP key revoked");
      if (createdToken) setCreatedToken(null);
      await refreshMcp();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reviewRequest = useMutation({
    mutationFn: (input: { requestId: string; approve: boolean }) =>
      reviewMcpTradeRequest({ data: input }),
    onSuccess: async (result) => {
      setProposalToApprove(null);
      toast.success(
        result.status === "APPROVED"
          ? "Approved command submitted to the MT5 Bridge"
          : result.status === "FAILED"
            ? "Risk checks blocked this command"
            : "Trade proposal rejected",
      );
      await refreshMcp();
    },
    onError: async (error: Error) => {
      setProposalToApprove(null);
      toast.error(error.message);
      await refreshMcp();
    },
  });

  const keys = keysQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
  const pendingRequests = requests.filter((request) => request.status === "PENDING_APPROVAL");
  const anyAiActive = keys.some((key) => !key.revoked_at && isRecentlyActive(key.last_used_at));
  const configForToken = (token: string) =>
    JSON.stringify(
      {
        mcpServers: {
          kocel: {
            type: "http",
            url: MCP_ENDPOINT,
            headers: { Authorization: `Bearer ${token}` },
          },
        },
      },
      null,
      2,
    );

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Clipboard access failed. Select and copy the text instead.");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI & MCP"
        description="Connect an MCP-compatible AI client to manage account-scoped bots, strategies, backtests, and MT5 actions."
      />

      <SectionCard
        title="AI connection status"
        description="MCP uses stateless requests, so activity is shown when the AI client makes an authenticated request."
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
              anyAiActive
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-muted text-muted-foreground"
            }`}
          >
            <span
              className={`size-2 rounded-full ${anyAiActive ? "bg-primary" : "bg-muted-foreground/50"}`}
            />
            {anyAiActive ? "AI active" : "No recent AI activity"}
          </span>
          <span className="text-xs text-muted-foreground">
            Active means a signed MCP request was received in the last two minutes.
          </span>
        </div>
      </SectionCard>

      <SectionCard
        title="Connect an AI client"
        description="Each key is limited to the currently selected MT5 account. Keys are shown once and stored only as a one-way hash."
        action={
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" />
            Per-account access
          </span>
        }
      >
        <div className="space-y-4">
          {active ? (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{active.account_name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {active.broker_name ?? active.broker?.name ?? "MT5 broker"} · {active.environment} ·{" "}
                {active.status}
              </p>
              {connections.length > 1 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  To scope a key to another account, select that account from the account switcher
                  first.
                </p>
              )}
            </div>
          ) : (
            <EmptyState
              icon={PlugZap}
              title="Connect an MT5 account first"
              description="MCP keys are scoped to one MT5 connection. Add a connection before creating a key."
            />
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={keyName}
              onChange={(event) => setKeyName(event.target.value)}
              aria-label="MCP key name"
              maxLength={60}
              placeholder="Key name"
              className="sm:max-w-sm"
            />
            <Button
              onClick={() => createKey.mutate()}
              disabled={!active || !keyName.trim() || createKey.isPending}
            >
              {createKey.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 size-4" />
              )}
              Create MCP key
            </Button>
          </div>
          <label className="flex max-w-2xl items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <Checkbox
              checked={canTradeDirectly}
              onCheckedChange={(checked) => setCanTradeDirectly(checked === true)}
              aria-label="Allow this MCP key to execute MT5 trades directly"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium">Allow direct MT5 trading</span>
              <span className="block text-xs text-muted-foreground">
                The AI can submit orders without a separate approval for each trade. Existing
                account risk limits and Bridge checks still apply; revoke this key to stop its
                access.
              </span>
            </span>
          </label>

          {createdToken && (
            <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="size-4 text-amber-600" />
                Copy your key now
              </p>
              <p className="text-xs text-muted-foreground">
                This secret is not saved in the browser or shown again. Treat it like a password;
                revoke it if it is exposed.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={createdToken} readOnly aria-label="New MCP API key" />
                <Button variant="outline" onClick={() => void copyText(createdToken, "MCP key")}>
                  <Copy className="mr-2 size-4" />
                  Copy key
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void copyText(configForToken(createdToken), "MCP client config")}
                >
                  <Copy className="mr-2 size-4" />
                  Copy config
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                {configForToken(createdToken)}
              </pre>
              <Button size="sm" variant="ghost" onClick={() => setCreatedToken(null)}>
                I saved the key
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            MCP endpoint: <code className="rounded bg-muted px-1.5 py-0.5">{MCP_ENDPOINT}</code>
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="MCP keys"
        description="An active indicator means the key has made a request in the last two minutes."
      >
        {keysQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading MCP keys…</p>
        ) : keysQuery.isError ? (
          <p className="text-sm text-destructive">
            Could not load MCP keys. Refresh the page to try again.
          </p>
        ) : keys.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No MCP keys yet"
            description="Create a key to connect your AI client. You can revoke it at any time."
          />
        ) : (
          <ul className="divide-y divide-border">
            {keys.map((key) => {
              const account = connections.find((connection) => connection.id === key.connection_id);
              const activeNow = !key.revoked_at && isRecentlyActive(key.last_used_at);
              return (
                <li
                  key={key.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                      {key.name}
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                        {key.token_hint}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {account?.account_name ?? "MT5 account"} · created{" "}
                      {new Date(key.created_at).toLocaleString()}
                      {key.last_used_at &&
                        ` · last request ${new Date(key.last_used_at).toLocaleString()}`}
                    </p>
                    <p className="mt-1 text-xs">
                      <span
                        className={
                          key.can_trade_directly
                            ? "font-medium text-amber-700"
                            : "text-muted-foreground"
                        }
                      >
                        {key.can_trade_directly ? "Direct trading enabled" : "No direct trading"}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                        key.revoked_at
                          ? "bg-muted text-muted-foreground"
                          : activeNow
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {key.revoked_at ? (
                        <CircleX className="size-3.5" />
                      ) : activeNow ? (
                        <CircleCheck className="size-3.5" />
                      ) : (
                        <span className="size-2 rounded-full bg-muted-foreground/50" />
                      )}
                      {key.revoked_at ? "Revoked" : activeNow ? "AI active" : "Not active"}
                    </span>
                    {!key.revoked_at && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={revokeKey.isPending}
                        onClick={() => revokeKey.mutate(key.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Earlier trade proposals"
        description="This list is retained for proposals created by older MCP clients. New clients use execute_trade and do not need per-trade site approval."
        action={
          pendingRequests.length > 0 ? (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700">
              {pendingRequests.length} awaiting review
            </span>
          ) : undefined
        }
      >
        {requestsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading trade proposals…</p>
        ) : requestsQuery.isError ? (
          <p className="text-sm text-destructive">
            Could not load proposals. Refresh the page to try again.
          </p>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No trade proposals"
            description="No earlier proposals are waiting. New direct commands are checked and queued by the MT5 Bridge."
          />
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((request) => {
              const account = connections.find(
                (connection) => connection.id === request.connection_id,
              );
              return (
                <li key={request.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{proposalSummary(request.payload)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {account?.account_name ?? "MT5 account"} ·{" "}
                        {new Date(request.created_at).toLocaleString()}
                      </p>
                      {request.decision_reason && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {request.decision_reason}
                        </p>
                      )}
                      {request.command_id && (
                        <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
                          MT5 command {request.command_id}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {statusLabel(request.status)}
                      </span>
                      {request.status === "PENDING_APPROVAL" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reviewRequest.isPending}
                            onClick={() =>
                              reviewRequest.mutate({ requestId: request.id, approve: false })
                            }
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            disabled={reviewRequest.isPending}
                            onClick={() => setProposalToApprove(request)}
                          >
                            Approve
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {request.status === "PENDING_APPROVAL" && (
                    <dl className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                      {request.payload.stopLoss !== undefined && (
                        <div>Stop loss: {request.payload.stopLoss}</div>
                      )}
                      {request.payload.takeProfit !== undefined && (
                        <div>Take profit: {request.payload.takeProfit}</div>
                      )}
                      {request.payload.positionTicket && (
                        <div>Position ticket: {request.payload.positionTicket}</div>
                      )}
                      {request.payload.orderTicket && (
                        <div>Order ticket: {request.payload.orderTicket}</div>
                      )}
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Available AI tools">
        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          <li className="flex gap-2 rounded-md border border-border p-3">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <strong>get_mt5_account</strong> — read account status and the latest snapshot.
            </span>
          </li>
          <li className="flex gap-2 rounded-md border border-border p-3">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <strong>list_open_positions</strong> — read current positions.
            </span>
          </li>
          <li className="flex gap-2 rounded-md border border-border p-3">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <strong>list_pending_orders</strong> — read pending orders.
            </span>
          </li>
          <li className="flex gap-2 rounded-md border border-border p-3">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <strong>execute_trade</strong> — queue orders directly when direct trading is enabled
              on the key. Risk limits and Bridge checks still apply; provide a stable
              clientRequestId to make retries idempotent.
            </span>
          </li>
          {[
            ["list_bots", "read account bots"],
            ["create_bot / update_bot / set_bot_status / delete_bot", "manage account bots"],
            ["list_strategies", "read built-in and user-owned strategies"],
            [
              "create_strategy / edit_strategy / rename_strategy / delete_strategy",
              "manage owned strategies and private built-in overrides",
            ],
            [
              "list_backtests / run_backtest / get_backtest_sync / get_backtest / delete_backtest",
              "request and backtest full date-range MT5 history",
            ],
          ].map(([name, description]) => (
            <li key={name} className="flex gap-2 rounded-md border border-border p-3">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <strong>{name}</strong> — {description}.
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <AlertDialog
        open={Boolean(proposalToApprove)}
        onOpenChange={(open) => !open && setProposalToApprove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this MT5 command?</AlertDialogTitle>
            <AlertDialogDescription>
              {proposalToApprove && (
                <>
                  <span className="block font-medium text-foreground">
                    {proposalSummary(proposalToApprove.payload)}
                  </span>
                  <span className="mt-2 block">
                    This submits the command to your MT5 Bridge. Your configured risk limits are
                    checked before it is queued; execution still depends on the connected terminal.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewRequest.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!proposalToApprove || reviewRequest.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!proposalToApprove) return;
                reviewRequest.mutate({ requestId: proposalToApprove.id, approve: true });
              }}
            >
              {reviewRequest.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Approve & submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
