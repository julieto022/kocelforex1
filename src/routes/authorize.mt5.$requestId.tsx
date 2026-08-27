import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/kocel/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import {
  approveAuthorizationRequest,
  getAuthorizationRequest,
  rejectAuthorizationRequest,
} from "@/lib/functions/mt5.functions";
import { getBrokerList } from "@/services/brokers";

export const Route = createFileRoute("/authorize/mt5/$requestId")({
  component: MT5AuthorizationPage,
});

function MT5AuthorizationPage() {
  const { requestId } = Route.useParams();
  const { session } = useAuth();
  const [accountName, setAccountName] = useState("");
  const [nickname, setNickname] = useState("");
  const [brokerId, setBrokerId] = useState("");
  const [environment, setEnvironment] = useState<"DEMO" | "REAL">("REAL");

  const request = useQuery({
    queryKey: ["mt5-authorization", requestId],
    queryFn: () => getAuthorizationRequest({ data: { requestId } }),
    enabled: Boolean(session),
  });
  const brokers = useQuery({
    queryKey: ["brokers"],
    queryFn: getBrokerList,
    enabled: Boolean(session),
  });
  const requestedEnvironment =
    request.data?.environment === "DEMO" || request.data?.environment === "REAL"
      ? request.data.environment
      : null;
  const approve = useMutation({
    mutationFn: () =>
      approveAuthorizationRequest({
        data: {
          requestId,
          brokerId,
          accountName: accountName.trim() || request.data?.account_name || "MT5 account",
          nickname: nickname.trim() || null,
          accountType: null,
          environment: requestedEnvironment ?? environment,
        },
      }),
    onSuccess: () => toast.success("MT5 connection approved"),
    onError: (error: Error) => toast.error(error.message),
  });
  const reject = useMutation({
    mutationFn: () => rejectAuthorizationRequest({ data: { requestId } }),
    onSuccess: () => toast.success("MT5 connection rejected"),
    onError: (error: Error) => toast.error(error.message),
  });

  if (!session) {
    return (
      <AuthLayout
        title="Authorize MT5 connection"
        description="Sign in to Kocel to review this MT5 authorization request."
      >
        <Button asChild>
          <Link to="/login" search={{ redirectTo: `/authorize/mt5/${requestId}` }}>
            Sign in to Kocel
          </Link>
        </Button>
      </AuthLayout>
    );
  }
  if (request.isLoading)
    return (
      <AuthLayout title="Authorize MT5 connection" description="Loading the request…">
        <Loader2 className="size-5 animate-spin" />
      </AuthLayout>
    );
  if (request.isError || !request.data)
    return (
      <AuthLayout
        title="Request unavailable"
        description="This authorization request is invalid or has expired."
      >
        <p />
      </AuthLayout>
    );
  const expired = request.data.status === "EXPIRED";
  const decided = request.data.status !== "WAITING_FOR_USER";

  return (
    <AuthLayout
      title="Connect MT5 to Kocel"
      description="Review the terminal identity before approving this connection."
    >
      <div className="space-y-4">
        <dl className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Broker</dt>
            <dd>{request.data.broker_hint ?? "MT5 broker"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">MT5 account</dt>
            <dd className="num">••••{request.data.mt5_login.slice(-4)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Server</dt>
            <dd>{request.data.server}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">EA</dt>
            <dd>Kocel Bridge EA {request.data.ea_version}</dd>
          </div>
        </dl>
        {!expired && !decided && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="broker">Kocel broker record</Label>
              <select
                id="broker"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={brokerId}
                onChange={(event) => setBrokerId(event.target.value)}
              >
                <option value="">Select broker</option>
                {(brokers.data ?? []).map((broker) => (
                  <option key={broker.id} value={broker.id}>
                    {broker.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="environment">Environment</Label>
              <select
                id="environment"
                disabled={Boolean(requestedEnvironment)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={requestedEnvironment ?? environment}
                onChange={(event) => setEnvironment(event.target.value as "DEMO" | "REAL")}
              >
                <option value="DEMO">Demo</option>
                <option value="REAL">Real</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accountName">Account name</Label>
              <Input
                id="accountName"
                value={accountName}
                placeholder={request.data.account_name ?? "MT5 account"}
                onChange={(event) => setAccountName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nickname">Label (optional)</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Kocel never receives your broker password. Credentials remain inside MetaTrader 5.
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={!brokerId || approve.isPending}
                onClick={() => approve.mutate()}
              >
                <Check className="mr-2 size-4" />
                Approve connection
              </Button>
              <Button variant="outline" disabled={reject.isPending} onClick={() => reject.mutate()}>
                <X className="mr-2 size-4" />
                Reject
              </Button>
            </div>
          </>
        )}
        {(expired || decided) && (
          <p className="text-sm text-muted-foreground">
            This request is {request.data.status.toLowerCase().replaceAll("_", " ")}.
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
