import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export const BRIDGE_STEPS = [
  "Open MetaTrader 5 and log into your broker account.",
  "Download and install the Kocel Bridge EA.",
  "Attach the EA to an MT5 chart.",
  "Click Connect to Kocel inside the EA.",
  "Approve the connection in your browser.",
];

export function BridgeExplainer() {
  return (
    <p className="text-sm text-muted-foreground">
      The Kocel Bridge EA runs inside your MT5 terminal and securely communicates your approved
      account status and trading instructions with Kocel Forex Hub. Your broker password stays in
      your MT5 terminal — Kocel never asks for it.
    </p>
  );
}

export function BridgeStepList() {
  return (
    <ol className="space-y-2.5">
      {BRIDGE_STEPS.map((step, index) => (
        <li key={step} className="flex gap-3 text-sm">
          <span className="num flex size-5 shrink-0 items-center justify-center rounded border border-border bg-muted text-[0.68rem] font-semibold text-muted-foreground">
            {index + 1}
          </span>
          <span className="text-foreground/90">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export function BridgeDownloadActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        onClick={() =>
          toast.info("Bridge EA package arrives with the Phase 2 bridge release.", {
            description: "Your workspace will be notified when the download is available.",
          })
        }
      >
        <Download className="size-4" /> Download Kocel Bridge EA
      </Button>
      <Button size="sm" variant="outline" asChild>
        <a href="/help">
          <FileText className="size-4" /> Installation guide
        </a>
      </Button>
    </div>
  );
}
