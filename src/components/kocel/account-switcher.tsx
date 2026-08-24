import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Plug } from "lucide-react";

import { BridgeStatusBadge } from "@/components/kocel/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useConnections } from "@/lib/use-connections";
import { maskLogin } from "@/services/mt5";

export function AccountSwitcher() {
  const { connections, active, setActiveId, isLoading } = useConnections();

  if (isLoading) return <Skeleton className="h-9 w-44" />;

  if (!active) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:inline">
          No MT5 account connected
        </span>
        <Button size="sm" asChild>
          <Link to="/settings/mt5">
            <Plug className="size-3.5" />
            Connect Account
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[15rem] gap-2">
          <span className="truncate text-xs">
            <span className="text-muted-foreground">MT5:</span>{" "}
            <span className="font-medium">{active.broker?.name ?? "MT5"}</span>{" "}
            <span className="num text-muted-foreground">{maskLogin(active.mt5_login)}</span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs">Connected MT5 accounts</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {connections.map((connection) => (
          <DropdownMenuItem
            key={connection.id}
            onSelect={() => setActiveId(connection.id)}
            className="flex flex-col items-start gap-1 py-2"
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">
                {connection.nickname || connection.account_name}
              </span>
              {connection.id === active.id && <Check className="size-3.5 text-primary" />}
            </span>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="num text-xs text-muted-foreground">
                {connection.broker?.name} · {maskLogin(connection.mt5_login)} ·{" "}
                {connection.environment === "real" ? "Real" : "Demo"}
              </span>
              <BridgeStatusBadge status={connection.status} size="sm" />
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings/mt5" className="text-sm">
            <Plug className="size-3.5" />
            Manage MT5 accounts
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ConnectionIndicator() {
  const { active } = useConnections();
  return (
    <Link to="/settings/mt5" aria-label="MT5 connection details" className="hidden sm:block">
      <BridgeStatusBadge status={active?.status ?? "NOT_CONNECTED"} />
    </Link>
  );
}
