import {
  Activity,
  BarChart3,
  Bot,
  CandlestickChart,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export const primaryNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/bots", label: "Bots", icon: Bot },
  { to: "/strategies", label: "Strategies", icon: LineChart },
  { to: "/trades", label: "Trades", icon: Activity },
  { to: "/analysis", label: "Analysis", icon: BarChart3 },
  { to: "/markets", label: "Markets", icon: CandlestickChart },
];

export const secondaryNav: NavItem[] = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: HelpCircle },
];

export const mobileNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/bots", label: "Bots", icon: Bot },
  { to: "/trades", label: "Trades", icon: Activity },
  { to: "/markets", label: "Markets", icon: CandlestickChart },
];

export const settingsNav = [
  { to: "/settings/profile", label: "Profile" },
  { to: "/settings/security", label: "Security" },
  { to: "/settings/mt5", label: "MT5 Accounts" },
  { to: "/settings/notifications", label: "Notifications" },
  { to: "/settings/appearance", label: "Appearance" },
  { to: "/settings/trading", label: "Trading" },
  { to: "/settings/general", label: "General" },
];

export const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/bots": "Bots",
  "/bots/create": "Create Bot",
  "/strategies": "Strategies",
  "/trades": "Trades",
  "/analysis": "Analysis",
  "/markets": "Markets",
  "/notifications": "Notifications",
  "/help": "Help & Documentation",
  "/settings": "Settings",
  "/settings/profile": "Profile",
  "/settings/security": "Security",
  "/settings/mt5": "MT5 Broker Accounts",
  "/settings/notifications": "Notifications",
  "/settings/appearance": "Appearance",
  "/settings/trading": "Trading Preferences",
  "/settings/general": "General",
};
