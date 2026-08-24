import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AccountSwitcher, ConnectionIndicator } from "@/components/kocel/account-switcher";
import { KocelLogo } from "@/components/kocel/brand";
import {
  mobileNav,
  pageTitles,
  primaryNav,
  secondaryNav,
  type NavItem,
} from "@/components/kocel/nav-config";
import { NotificationCenter } from "@/components/kocel/notification-center";
import { ThemeToggle } from "@/components/kocel/theme-toggle";
import { UserMenu } from "@/components/kocel/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: (() => void) | undefined }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          activeOptions={{ exact: item.to === "/dashboard" }}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground data-[status=active]:bg-primary/12 data-[status=active]:text-primary"
        >
          <item.icon className="size-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="px-1.5 py-2">
        <Link to="/dashboard" onClick={onNavigate} aria-label="Kocel Forex Hub dashboard">
          <KocelLogo />
        </Link>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto">
        <NavLinks items={primaryNav} onNavigate={onNavigate} />
        <div className="border-t border-sidebar-border pt-4">
          <NavLinks items={secondaryNav} onNavigate={onNavigate} />
        </div>
      </div>
      <UserMenu variant="row" />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  const title =
    pageTitles[pathname] ??
    pageTitles[`/${pathname.split("/").filter(Boolean)[0] ?? ""}`] ??
    "Kocel";

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarBody />
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-border bg-surface/85 backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-sidebar p-0">
                <SheetTitle className="sr-only">Kocel navigation</SheetTitle>
                <SidebarBody onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
              <p className="hidden truncate text-[0.68rem] text-muted-foreground sm:block">
                Kocel Forex Hub{pathname === "/dashboard" ? "" : ` · ${title}`}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="hidden md:flex md:items-center md:gap-2">
                <AccountSwitcher />
                <ConnectionIndicator />
              </div>
              <NotificationCenter />
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-border px-3 py-2 md:hidden">
            <AccountSwitcher />
            <ConnectionIndicator />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[100rem] px-3 pb-24 pt-4 sm:px-4 sm:pb-10 sm:pt-5">
          {children}
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}

function MobileTabBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {mobileNav.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex flex-col items-center gap-1 py-2 text-[0.65rem] font-medium text-muted-foreground data-[status=active]:text-primary"
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className={cn(
                "flex w-full flex-col items-center gap-1 py-2 text-[0.65rem] font-medium",
                menuOpen ? "text-primary" : "text-muted-foreground",
              )}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              Menu
            </button>
          </li>
        </ul>
      </nav>

      {menuOpen && (
        <div className="fixed inset-x-0 bottom-14 z-30 border-t border-border bg-popover p-3 shadow-lift lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {[
              { to: "/strategies", label: "Strategies" },
              { to: "/analysis", label: "Analysis" },
              { to: "/settings", label: "Settings" },
              { to: "/help", label: "Help" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="rounded-md border border-border px-3 py-2.5 text-sm font-medium"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <Button
            variant="outline"
            className="mt-2 w-full text-destructive"
            onClick={() => setMenuOpen(false)}
            asChild
          >
            <Link to="/settings/security">
              <LogOut className="size-4" /> Sessions & sign out
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
