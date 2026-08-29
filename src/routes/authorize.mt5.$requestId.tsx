import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/kocel/auth-layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  approveAuthorizationRequest,
  getAuthorizationRequest,
  rejectAuthorizationRequest,
} from "@/lib/functions/mt5.functions";

export const Route = createFileRoute("/authorize/mt5/$requestId")({
  component: MT5AuthorizationPage,
});

function MT5AuthorizationPage() {
  const { requestId } = Route.useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const request = useQuery({
    queryKey: ["mt5-authorization", requestId],
    queryFn: () => getAuthorizationRequest({ data: { requestId } }),
    enabled: Boolean(session),
  });
  const approve = useMutation({
    mutationFn: () => approveAuthorizationRequest({ data: { requestId } }),
    onSuccess: async () => {
      toast.success("Connection approved. Synchronizing your MT5 account…");
      await queryClient.invalidateQueries();
      navigate({ to: "/dashboard", replace: true });
    },
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
  const validation = request.data.validation;

  return (
    <AuthLayout
      title="Connect MT5 to Kocel"
      description="Review the terminal identity before approving this connection."
    >
      <div className="space-y-4">
        <dl className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Broker</dt>
            <dd>{request.data.broker_hint ?? "Unavailable"}</dd>
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
            <dt className="text-muted-foreground">Environment</dt>
            <dd>{request.data.environment ?? "Unavailable"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Account</dt>
            <dd>{request.data.account_name ?? "Unavailable"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Currency</dt>
            <dd>{request.data.currency ?? "Unavailable"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Leverage</dt>
            <dd>{request.data.leverage ? `1:${request.data.leverage}` : "Unavailable"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">EA</dt>
            <dd>Kocel Bridge EA {request.data.ea_version}</dd>
          </div>
          {request.data.terminal_build && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Terminal build</dt>
              <dd>{request.data.terminal_build}</dd>
            </div>
          )}
          {(request.data.terminal_name || request.data.terminal_company) && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Terminal</dt>
              <dd>
                {[request.data.terminal_name, request.data.terminal_company]
                  .filter(Boolean)
                  .join(" — ")}
              </dd>
            </div>
          )}
        </dl>
        {!expired && !decided && (
          <>
            <p className={validation.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
              {validation.message}
            </p>
            <p className="text-xs text-muted-foreground">
              Kocel never receives your broker password. Credentials remain inside MetaTrader 5.
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={!validation?.ok || approve.isPending}
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
