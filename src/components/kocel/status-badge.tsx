import { cn } from "@/lib/utils";
import { BRIDGE_STATUS_MODEL, type BridgeStatus, type StatusTone } from "@/services/types";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-success/12 text-success border-success/30",
  warning: "bg-warning/12 text-warning border-warning/30",
  danger: "bg-destructive/12 text-destructive border-destructive/30",
  info: "bg-info/12 text-info border-info/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

const dotClasses: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
  dot = true,
  size = "md",
}: {
  tone?: StatusTone | undefined;
  children: React.ReactNode;
  className?: string | undefined;
  dot?: boolean | undefined;
  size?: "sm" | "md" | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[0.68rem]" : "px-2.5 py-1 text-xs",
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dotClasses[tone])} />}
      {children}
    </span>
  );
}

export function BridgeStatusBadge({
  status,
  className,
  size = "md",
}: {
  status: BridgeStatus;
  className?: string | undefined;
  size?: "sm" | "md" | undefined;
}) {
  const model = BRIDGE_STATUS_MODEL[status] ?? BRIDGE_STATUS_MODEL.NOT_CONNECTED;
  return (
    <StatusBadge tone={model.tone} className={className} size={size}>
      {model.label}
    </StatusBadge>
  );
}
