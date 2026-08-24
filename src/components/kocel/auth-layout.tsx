import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { KocelLogo } from "@/components/kocel/brand";
import { ThemeToggle } from "@/components/kocel/theme-toggle";

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-background">
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Kocel Forex Hub home">
            <KocelLogo />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 flex-col justify-center py-8">
          <div className="panel p-5 sm:p-6">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            <div className="mt-5">{children}</div>
          </div>
          {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
