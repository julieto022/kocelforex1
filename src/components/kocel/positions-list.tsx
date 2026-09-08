import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, CheckCircle, Clock, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useConnections } from "@/lib/use-connections";
import { EmptyState, SectionCard } from "./states";

type OpenPosition = {
  ticket: number;
  symbol: string;
  direction: string;
  volume: number;
  open_price: number | null;
  current_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  current_profit: number | null;
};

type CloseState = {
  ticket: number;
  commandId: string | null;
  status: "queued" | "working" | "done" | "error";
  message: string;
};

export function PositionsList() {
  const { user, session } = useAuth();
  const { active } = useConnections();
  const [closing, setClosing] = useState<CloseState | null>(null);

  const positionsQuery = useQuery({
    queryKey: ["mt5-open-positions", user?.id, active?.id ?? null],
    enabled: Boolean(user?.id && active?.id),
    refetchInterval: 1000,
    queryFn: async (): Promise<OpenPosition[]> => {
      const { data, error } = await supabase
        .from("mt5_open_positions")
        .select(
          "ticket, symbol, direction, volume, open_price, current_price, stop_loss, take_profit, current_profit",
        )
        .eq("user_id", user!.id)
        .eq("broker_connection_id", active!.id)
        .order("ticket", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OpenPosition[];
    },
  });

  const positions = useMemo(() => positionsQuery.data ?? [], [positionsQuery.data]);

  // Follow the close command until MT5 reports back.
  const closeCommandId = closing?.commandId ?? null;
  const closeSettled = closing?.status === "done" || closing?.status === "error";

  useEffect(() => {
    if (!closeCommandId || closeSettled) return;
    let cancelled = false;

    const tick = async () => {
      const { data } = await supabase
        .from("mt5_trade_commands")
        .select("status, error_message")
        .eq("id", closeCommandId)
        .maybeSingle();
      if (cancelled || !data) return;

      setClosing((prev) => {
        if (!prev || prev.commandId !== closeCommandId) return prev;
        if (data.status === "EXECUTED") {
          return { ...prev, status: "done", message: "Position closed in MT5." };
        }
        if (data.status === "FAILED" || data.status === "REJECTED") {
          return {
            ...prev,
            status: "error",
            message: data.error_message || "MT5 rejected the close request.",
          };
        }
        if (data.status === "SENT" || data.status === "EXECUTING") {
          return { ...prev, status: "working", message: "MT5 is closing the position..." };
        }
        return prev;
      });
    };

    void tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [closeCommandId, closeSettled]);

  // Clear a finished banner after a short while.
  useEffect(() => {
    if (!closeSettled) return;
    const id = window.setTimeout(() => setClosing(null), 4000);
    return () => window.clearTimeout(id);
  }, [closeSettled, closing?.ticket]);

  const handleStop = async (ticket: number) => {
    if (!user || !active) return;
    const accessToken = session?.access_token;
    if (!accessToken) {
      setClosing({
        ticket,
        commandId: null,
        status: "error",
        message: "Your Kocel session has expired. Please sign in again.",
      });
      return;
    }

    setClosing({
      ticket,
      commandId: null,
      status: "queued",
      message: "Sending close request to your MT5 terminal...",
    });

    try {
      const response = await fetch("/api/protected/mt5/orders/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          connectionId: active.id,
          operation: "CLOSE_POSITION",
          positionTicket: ticket,
          clientRequestId: crypto.randomUUID(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setClosing({
          ticket,
          commandId: null,
          status: "error",
          message: data.error?.message || "Could not send the close request.",
        });
        return;
      }

      setClosing({
        ticket,
        commandId: data.data?.commandId ?? null,
        status: "working",
        message: "Close request queued. Waiting for MT5...",
      });
    } catch (error) {
      setClosing({
        ticket,
        commandId: null,
        status: "error",
        message: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  };

  return (
    <SectionCard
      title="Open positions"
      description="Live from your MT5 terminal, refreshed every second."
      bodyClassName="p-0 sm:p-0"
    >
      {closing && (
        <div
          className={`m-3 flex gap-2 rounded-md p-3 text-sm ${
            closing.status === "error"
              ? "bg-destructive/10 text-destructive"
              : closing.status === "done"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {closing.status === "error" && <AlertCircle className="mt-0.5 size-4 shrink-0" />}
          {closing.status === "done" && <CheckCircle className="mt-0.5 size-4 shrink-0" />}
          {(closing.status === "queued" || closing.status === "working") && (
            <Clock className="mt-0.5 size-4 shrink-0 animate-spin" />
          )}
          <div>
            #{closing.ticket} — {closing.message}
          </div>
        </div>
      )}

      {positions.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No open positions"
          description="Positions opened in MT5 appear here within a second."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Open</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>SL</TableHead>
                <TableHead>TP</TableHead>
                <TableHead>P/L</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position) => {
                const busy =
                  closing?.ticket === position.ticket &&
                  (closing.status === "queued" || closing.status === "working");
                const profit = position.current_profit ?? 0;
                return (
                  <TableRow key={position.ticket}>
                    <TableCell className="num">{position.ticket}</TableCell>
                    <TableCell className="num font-medium">{position.symbol}</TableCell>
                    <TableCell>{position.direction}</TableCell>
                    <TableCell className="num">{position.volume}</TableCell>
                    <TableCell className="num">{position.open_price ?? "—"}</TableCell>
                    <TableCell className="num">{position.current_price ?? "—"}</TableCell>
                    <TableCell className="num">{position.stop_loss ?? "—"}</TableCell>
                    <TableCell className="num">{position.take_profit ?? "—"}</TableCell>
                    <TableCell
                      className={`num ${profit >= 0 ? "text-emerald-600" : "text-destructive"}`}
                    >
                      {position.current_profit ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => handleStop(position.ticket)}
                      >
                        <Square className="mr-1 size-3" />
                        {busy ? "Stopping..." : "Stop"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
