import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle, Clock, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useConnections } from "@/lib/use-connections";
import { SectionCard } from "./states";

type ExecutionStatus = "idle" | "loading" | "success" | "error";

export function TradingPanel() {
  const { user, session } = useAuth();
  const { active } = useConnections();

  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [volume, setVolume] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [status, setStatus] = useState<ExecutionStatus>("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{
    commandId?: string;
    status?: string;
    message?: string;
    mt5Ticket?: string;
    errorCode?: string;
    executedPrice?: number;
  } | null>(null);

  const pollRef = useRef<number | null>(null);
  const commandId = result?.commandId;
  const liveStatus = result?.status;

  useEffect(() => {
    if (!commandId) return;
    if (liveStatus === "EXECUTED" || liveStatus === "FAILED" || liveStatus === "REJECTED") return;

    let cancelled = false;
    const tick = async () => {
      const { data } = await supabase
        .from("mt5_trade_commands")
        .select("id, status, mt5_ticket, executed_price, error_code, error_message")
        .eq("id", commandId)
        .maybeSingle();

      if (cancelled || !data) return;

      const next: {
        commandId?: string;
        status?: string;
        mt5Ticket?: string;
        errorCode?: string;
        executedPrice?: number;
      } = { commandId, status: data.status };
      if (data.mt5_ticket) next.mt5Ticket = String(data.mt5_ticket);
      if (data.error_code) next.errorCode = data.error_code;
      if (data.executed_price != null) next.executedPrice = data.executed_price;
      setResult(next);

      if (data.status === "EXECUTED") {
        setStatus("success");
        setMessage(
          `Order executed in MT5.${data.mt5_ticket ? ` Ticket: ${data.mt5_ticket}` : ""}${
            data.executed_price ? ` at ${data.executed_price}` : ""
          }`,
        );
      } else if (data.status === "FAILED" || data.status === "REJECTED") {
        setStatus("error");
        setMessage(data.error_message || "The MT5 terminal rejected this trade.");
      } else if (data.status === "SENT") {
        setStatus("loading");
        setMessage("Command delivered to the MT5 Bridge EA. Executing...");
      } else if (data.status === "EXECUTING") {
        setStatus("loading");
        setMessage("MT5 is executing your order...");
      }
    };

    void tick();
    pollRef.current = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [commandId, liveStatus]);

  const handleExecute = async () => {
    if (!user || !active) {
      setStatus("error");
      setMessage("No active connection. Please connect an MT5 account.");
      return;
    }

    if (!symbol.trim()) {
      setStatus("error");
      setMessage("Please enter a symbol.");
      return;
    }

    if (!volume) {
      setStatus("error");
      setMessage("Please enter a volume.");
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      setStatus("error");
      setMessage("Your Kocel session has expired. Please sign in again.");
      return;
    }

    setStatus("loading");
    setMessage("");
    setResult(null);

    try {
      const response = await fetch("/api/protected/mt5/orders/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          connectionId: active.id,
          operation: "OPEN_MARKET",
          symbol: symbol.trim().toUpperCase(),
          side,
          volume: parseFloat(volume),
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
          clientRequestId: crypto.randomUUID(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error?.message || "Trade execution failed.");
        return;
      }

      setResult(data.data);
      if (data.data.status === "PENDING") {
        setStatus("loading");
        setMessage("Trade command queued. Waiting for MT5 Bridge EA execution...");
      } else if (data.data.status === "EXECUTED") {
        setStatus("success");
        setMessage(`Order executed. Ticket: ${data.data.mt5Ticket}`);
      } else {
        setStatus("error");
        setMessage(data.data.message || "Trade failed.");
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "An error occurred.");
    }
  };

  const isConnected = active?.status === "CONNECTED";

  return (
    <SectionCard title="Manual Trading">
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {isConnected
            ? "MT5 Bridge is connected. You can execute trades."
            : "MT5 Bridge is not connected. Connect an account to trade."}
        </div>

        {/* Symbol and Side Row */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium">Symbol</label>
            <Input
              placeholder="e.g., EURUSD"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              disabled={!isConnected}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Side</label>
            <Select
              value={side}
              onValueChange={(v) => setSide(v as "BUY" | "SELL")}
              disabled={!isConnected}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUY">BUY</SelectItem>
                <SelectItem value="SELL">SELL</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Volume Row */}
        <div>
          <label className="text-xs font-medium">Volume (Lots)</label>
          <Input
            type="number"
            placeholder="0.01"
            step="0.01"
            min="0"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            disabled={!isConnected}
            className="mt-1"
          />
        </div>

        {/* SL/TP Row */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium">Stop Loss (Optional)</label>
            <Input
              type="number"
              placeholder="0.00"
              step="0.00001"
              min="0"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              disabled={!isConnected}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Take Profit (Optional)</label>
            <Input
              type="number"
              placeholder="0.00"
              step="0.00001"
              min="0"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              disabled={!isConnected}
              className="mt-1"
            />
          </div>
        </div>

        {/* Status Messages */}
        {status !== "idle" && (
          <div
            className={`rounded-md p-3 text-sm flex gap-2 ${
              status === "success"
                ? "bg-green-50 text-green-900"
                : status === "error"
                  ? "bg-red-50 text-red-900"
                  : "bg-blue-50 text-blue-900"
            }`}
          >
            {status === "success" && <CheckCircle className="size-4 shrink-0 mt-0.5" />}
            {status === "error" && <AlertCircle className="size-4 shrink-0 mt-0.5" />}
            {status === "loading" && <Clock className="size-4 shrink-0 mt-0.5 animate-spin" />}
            <div>{message}</div>
          </div>
        )}

        {/* Execute Button */}
        <Button
          onClick={handleExecute}
          disabled={!isConnected || status === "loading"}
          className="w-full"
          variant={side === "SELL" ? "destructive" : "default"}
        >
          <Send className="mr-2 size-4" />
          {status === "loading" ? "Executing..." : `Execute ${side}`}
        </Button>

        {/* Result Details */}
        {result && (
          <div className="text-xs space-y-1 rounded-md border border-border bg-muted p-2">
            <div>
              <span className="font-medium">Status:</span> {result.status}
            </div>
            {result.mt5Ticket && (
              <div>
                <span className="font-medium">Ticket:</span> {result.mt5Ticket}
              </div>
            )}
            {result.executedPrice != null && (
              <div>
                <span className="font-medium">Price:</span> {result.executedPrice}
              </div>
            )}
            {result.errorCode && (
              <div>
                <span className="font-medium">Error:</span> {result.errorCode}
              </div>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
