import { Copy, Download, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export const BRIDGE_STEPS = [
  "Download the Kocel Bridge EA.",
  "Open MetaTrader 5 on your desktop or VPS.",
  "Install the EA into the Experts folder and refresh the Navigator.",
  "Attach Kocel Bridge EA to any chart of the account you are connecting.",
  "Enter your Kocel connection code in the EA inputs.",
  "Enable algorithmic trading and allow WebRequest for the Kocel endpoint.",
  "Start the EA and confirm the smiley icon is active.",
  "Return to Kocel and verify the connection status.",
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

export function ConnectionCodeBlock({ code }: { code: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border-strong bg-muted/50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[0.68rem] font-medium uppercase tracking-wide text-muted-foreground">
          Connection code
        </p>
        <p className="num truncate text-lg font-semibold text-foreground">{code ?? "—"}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={!code}
        onClick={() => {
          if (!code) return;
          void navigator.clipboard.writeText(code);
          toast.success("Connection code copied");
        }}
      >
        <Copy className="size-3.5" /> Copy
      </Button>
    </div>
  );
}
