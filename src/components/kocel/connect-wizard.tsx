import { ShieldCheck } from "lucide-react";

import {
  BridgeDownloadActions,
  BridgeExplainer,
  BridgeStepList,
} from "@/components/kocel/bridge-steps";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConnectWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect MT5</DialogTitle>
          <DialogDescription>
            Connect your broker in MetaTrader 5, then authorize the Kocel Bridge EA in your browser.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <BridgeExplainer />
          <BridgeStepList />
          <p className="flex items-start gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-foreground/80">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-info" />
            Kocel does not require or store your MT5 broker password. Your broker credentials remain inside MetaTrader 5.
          </p>
          <BridgeDownloadActions />
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
