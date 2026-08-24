import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/kocel/page-header";
import { EmptyState, ErrorState, SectionCard, TableSkeleton } from "@/components/kocel/states";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { useConnections } from "@/lib/use-connections";
import { getTrades } from "@/services/trades";

export const Route = createFileRoute("/_app/trades")({
  component: TradesPage,
});

function TradesPage() {
  const { user } = useAuth();
  const { active } = useConnections();
  const [symbol, setSymbol] = useState("");
  const [status, setStatus] = useState<"all" | "open" | "closed">("all");

  const tradesQuery = useQuery({
    queryKey: ["trades", user?.id, active?.id ?? null, symbol, status],
    queryFn: () =>
      getTrades(user!.id, {
        connectionId: active?.id ?? null,
        symbol: symbol.trim() || undefined,
        status: status === "all" ? undefined : status,
      }),
    enabled: Boolean(user?.id),
  });

  const trades = tradesQuery.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trades"
        description="Trade history reported by the Kocel Bridge EA for the selected MT5 account."
      />

      <SectionCard
        title="Trade history"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-8 w-36"
              placeholder="Symbol"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              maxLength={20}
            />
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        bodyClassName="p-0 sm:p-0"
      >
        {tradesQuery.isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={6} />
          </div>
        ) : tradesQuery.isError ? (
          <ErrorState onRetry={() => void tradesQuery.refetch()} />
        ) : trades.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No trades to show"
            description="Trades appear here once your connected MT5 terminal reports activity."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Exit</TableHead>
                  <TableHead>P/L</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell className="num font-medium">{trade.symbol}</TableCell>
                    <TableCell>{trade.type}</TableCell>
                    <TableCell className="num">{trade.volume ?? "—"}</TableCell>
                    <TableCell className="num">{trade.entry_price ?? "—"}</TableCell>
                    <TableCell className="num">{trade.exit_price ?? "—"}</TableCell>
                    <TableCell className="num">{trade.profit ?? "—"}</TableCell>
                    <TableCell>{trade.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
