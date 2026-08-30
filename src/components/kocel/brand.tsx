import { cn } from "@/lib/utils";

export const APP_NAME = "Kocel Forex Hub";
export const TAGLINE = "One Hub. Any MT5 Broker. Smarter Trading.";

export function KocelMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      >
        <path d="M4 18V6" strokeLinecap="round" />
        <path d="M20 6l-8 6 8 6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 12h6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function KocelLogo({
  className,
  showTagline = false,
}: {
  className?: string | undefined;
  showTagline?: boolean | undefined;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <KocelMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[0.95rem] font-bold tracking-[0.16em] text-foreground">
          KOCEL
        </span>
        <span className="text-[0.65rem] font-medium tracking-wide text-muted-foreground">
          {showTagline ? TAGLINE : "FOREX HUB"}
        </span>
      </span>
    </span>
  );
}
