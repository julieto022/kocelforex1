import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { HelpCircle, LogOut, Settings, Shield, User } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { logout } from "@/services/auth";

export function initialsOf(name: string | null | undefined, fallback = "K") {
  if (!name) return fallback;
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu({ variant = "avatar" }: { variant?: "avatar" | "row" }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const name = profile?.full_name || profile?.username || "Kocel trader";

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await logout();
    toast.success("Signed out");
    navigate({ to: "/login", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "avatar" ? (
          <Button variant="ghost" size="icon" aria-label="Account menu">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                {initialsOf(name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent"
          >
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                {initialsOf(name)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-sidebar-foreground">
                {name}
              </span>
              <span className="block truncate text-[0.68rem] text-muted-foreground">
                {user?.email}
              </span>
            </span>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-sm">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: "/settings/profile" })}>
          <User className="size-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/settings" })}>
          <Settings className="size-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/settings/security" })}>
          <Shield className="size-4" /> Security
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: "/help" })}>
          <HelpCircle className="size-4" /> Help
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => void handleSignOut()}
        >
          <LogOut className="size-4" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
