import { useState } from "react";
import { X, Settings, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useConnections } from "@/lib/use-connections";
import { SectionCard } from "./states";

interface Position {
  id: string;
  ticket: number;
  symbol: string;
  direction: "BUY" | "SELL";
  volume: number;
  open_price: number;
  current_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  current_profit: number;
}

interface PositionActionState {
  type: "close" | "modify" | null;
  positionTicket: number | null;
  newSL: string;
  newTP: string;
  status: "idle" | "loading" | "success" | "error";
  message: string;
}

export function PositionsList() {
  const { user, session } = useAuth();
  const { active } = useConnections();

  const [action, setAction] = useState<PositionActionState>({
    type: null,
    positionTicket: null,
    newSL: "",
    newTP: "",
    status: "idle",
    message: "",
  });

  const isConnected = active?.status === "CONNECTED";

  // Placeholder: Real positions would be fetched from mt5_open_positions table
  const positions: Position[] = [];

  const handleClose = async (ticket: number) => {
    if (!user || !active) return;

    const accessToken = session?.access_token;
    if (!accessToken) {
      setAction((prev) => ({
        ...prev,
        type: "close",
        positionTicket: ticket,
        status: "error",
        message: "Your Kocel session has expired. Please sign in again.",
      }));
      return;
    }

    setAction({
      type: "close",
      positionTicket: ticket,
      newSL: "",
      newTP: "",
      status: "loading",
      message: "Closing position...",
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
        setAction((prev) => ({
          ...prev,
          status: "error",
          message: data.error?.message || "Failed to close position.",
        }));
        return;
      }

      setAction((prev) => ({
        ...prev,
        status: "success",
        message: "Close command sent to MT5 Bridge EA.",
      }));

      // Reset after 2 seconds
      setTimeout(() => {
        setAction({
          type: null,
          positionTicket: null,
          newSL: "",
          newTP: "",
          status: "idle",
          message: "",
        });
      }, 2000);
    } catch (error) {
      setAction((prev) => ({
        ...prev,
        status: "error",
        message: error instanceof Error ? error.message : "An error occurred.",
      }));
    }
  };

  const handleModify = async (ticket: number) => {
    if (!user || !active) return;

    if (!action.newSL && !action.newTP) {
      setAction((prev) => ({
        ...prev,
        status: "error",
        message: "Enter at least SL or TP.",
      }));
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      setAction((prev) => ({
        ...prev,
        status: "error",
        message: "Your Kocel session has expired. Please sign in again.",
      }));
      return;
    }

    setAction((prev) => ({ ...prev, status: "loading", message: "Modifying position..." }));

    try {
      const response = await fetch("/api/protected/mt5/orders/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          connectionId: active.id,
          operation: "MODIFY_POSITION",
          positionTicket: ticket,
          stopLoss: action.newSL ? parseFloat(action.newSL) : undefined,
          takeProfit: action.newTP ? parseFloat(action.newTP) : undefined,
          clientRequestId: crypto.randomUUID(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAction((prev) => ({
          ...prev,
          status: "error",
          message: data.error?.message || "Failed to modify position.",
        }));
        return;
      }

      setAction((prev) => ({
        ...prev,
        status: "success",
        message: "Modify command sent to MT5 Bridge EA.",
      }));

      setTimeout(() => {
        setAction({
          type: null,
          positionTicket: null,
          newSL: "",
          newTP: "",
          status: "idle",
          message: "",
        });
      }, 2000);
    } catch (error) {
      setAction((prev) => ({
        ...prev,
        status: "error",
        message: error instanceof Error ? error.message : "An error occurred.",
      }));
    }
  };

  if (positions.length === 0) {
    return null;
  }

  return (
    <SectionCard title="Position Actions">
      <div className="space-y-3">
        {action.type && (
          <div
            className={`rounded-md p-3 text-sm ${
              action.status === "error"
                ? "bg-red-50 text-red-900"
                : action.status === "success"
                  ? "bg-green-50 text-green-900"
                  : "bg-blue-50 text-blue-900"
            }`}
          >
            <div className="flex gap-2">
              {action.status === "error" && <AlertCircle className="size-4 shrink-0 mt-0.5" />}
              <div>{action.message}</div>
            </div>
          </div>
        )}

        {action.type === "modify" && action.positionTicket && (
          <div className="border border-border rounded-md p-3 space-y-3">
            <div>
              <label className="text-xs font-medium">Stop Loss</label>
              <Input
                type="number"
                placeholder="0.00000"
                step="0.00001"
                value={action.newSL}
                onChange={(e) => setAction((prev) => ({ ...prev, newSL: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Take Profit</label>
              <Input
                type="number"
                placeholder="0.00000"
                step="0.00001"
                value={action.newTP}
                onChange={(e) => setAction((prev) => ({ ...prev, newTP: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleModify(action.positionTicket!)}
                disabled={action.status === "loading" || (!action.newSL && !action.newTP)}
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setAction({
                    type: null,
                    positionTicket: null,
                    newSL: "",
                    newTP: "",
                    status: "idle",
                    message: "",
                  })
                }
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {isConnected
            ? "Click Close or Modify to manage your positions."
            : "MT5 Bridge must be connected to modify positions."}
        </div>
      </div>
    </SectionCard>
  );
}
