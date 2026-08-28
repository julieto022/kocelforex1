import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bot,
  Layers,
  LineChart,
  Lock,
  ShieldCheck,
} from "lucide-react";

import { KocelLogo, TAGLINE } from "@/components/kocel/brand";
import { StatusBadge } from "@/components/kocel/status-badge";
import { ThemeToggle } from "@/components/kocel/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { brokerStatusLabel, getBrokerList } from "@/services/brokers";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kocel Forex Hub — Trade Smarter. Connect Any MT5 Broker." },
      {
        name: "description",
        content:
          "Kocel Forex Hub gives traders one platform to monitor, analyze and automate MT5 trading across any broker supported by MetaTrader 5.",
      },
      { property: "og:title", content: "Kocel Forex Hub — One Hub. Any MT5 Broker." },
      {
        property: "og:description",
        content:
          "Connect multiple MT5 broker accounts to one independent Kocel workspace through the Kocel Bridge EA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const features = [
  {
    icon: Layers,
    title: "Multi-Broker",
    body: "Connect multiple MT5 accounts from one Kocel account.",
  },
  {
    icon: Bot,
    title: "Automated Trading",
    body: "Run Kocel trading bots through your connected MT5 terminal.",
  },
  {
    icon: LineChart,
    title: "Strategy Engine",
    body: "Build and apply multiple trading strategies.",
  },
  { icon: ShieldCheck, title: "Risk Management", body: "Control exposure and trading risk." },
  { icon: Activity, title: "Trade Monitoring", body: "Monitor open positions and trading activity." },
  {
    icon: BarChart3,
    title: "Performance Analytics",
    body: "Analyze trading history and performance.",
  },
];

const steps = [
  { title: "Create Kocel Account", body: "One independent Kocel identity, separate from any broker." },
  { title: "Connect MT5 Broker", body: "Add the MT5 account details Kocel should manage." },
  { title: "Install Kocel Bridge EA", body: "Attach the Bridge EA to a chart in your MT5 terminal." },
  { title: "Start Trading", body: "Monitor, analyze and automate from one workspace." },
];

function LandingPage() {
  const { session } = useAuth();
  const brokersQuery = useQuery({ queryKey: ["brokers"], queryFn: getBrokerList });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" aria-label="Kocel Forex Hub home">
            <KocelLogo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#brokers" className="hover:text-foreground">
              Brokers
            </a>
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#security" className="hover:text-foreground">
              Security
            </a>
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            {session ? (
              <Button size="sm" asChild>
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register">Create Free Account</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-2 lg:py-20">
            <div>
              <StatusBadge tone="success" size="sm">
                {TAGLINE}
              </StatusBadge>
              <h1 className="mt-4 text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-5xl">
                Trade Smarter. Connect Any MT5 Broker.
              </h1>
              <p className="mt-4 max-w-xl text-base text-muted-foreground">
                Kocel Forex Hub gives traders one powerful platform to monitor, analyze and automate
                their MT5 trading across supported brokers.
              </p>
              <div className="mt-7 flex flex-wrap gap-2.5">
                <Button size="lg" asChild>
                  <Link to="/register">Create Free Account</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/login">Sign In</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Kocel is not a broker. You keep your broker account and connect it through the Kocel
                Bridge EA.
              </p>
            </div>

            <DashboardPreview />
          </div>
        </section>

        <section id="brokers" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-semibold text-foreground">Connect Your MT5 Broker</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Kocel is broker-independent. Support is added broker by broker — statuses below show
              exactly what is available today.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {brokersQuery.isLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-28 w-full rounded-lg" />
                  ))
                : (brokersQuery.data ?? []).map((broker) => (
                    <article key={broker.id} className="panel flex flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{broker.name}</h3>
                        <StatusBadge
                          tone={broker.status === "supported" ? "success" : "neutral"}
                          size="sm"
                        >
                          {brokerStatusLabel(broker)}
                        </StatusBadge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {broker.capabilities.length > 0
                          ? broker.capabilities.slice(0, 4).join(" · ")
                          : "Additional MT5 brokers are being added to the Kocel adapter layer."}
                      </p>
                    </article>
                  ))}
            </div>
          </div>
        </section>

        <section id="features" className="border-b border-border bg-surface/40">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-semibold text-foreground">Built for MT5 traders</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.title} className="panel p-4">
                  <span className="inline-flex size-9 items-center justify-center rounded-md bg-primary/12 text-primary">
                    <feature.icon className="size-4" />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-semibold text-foreground">How it works</h2>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <li key={step.title} className="panel p-4">
                  <span className="num text-xs font-semibold text-primary">
                    STEP {index + 1}
                  </span>
                  <h3 className="mt-2 text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="security" className="border-b border-border bg-surface/40">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-semibold text-foreground">How Kocel handles access</h2>
            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              {[
                {
                  icon: Lock,
                  title: "Kocel accounts are independent",
                  body: "Your Kocel login is separate from every broker account. Broker credentials should never be used as Kocel login credentials.",
                },
                {
                  icon: ShieldCheck,
                  title: "Bridge-based connectivity",
                  body: "MT5 connectivity is established through the Kocel Bridge EA running in your own terminal. Kocel does not ask for your broker trading password.",
                },
                {
                  icon: Layers,
                  title: "You control connections",
                  body: "You decide which broker accounts are connected, and you can disconnect any of them at any time.",
                },
                {
                  icon: Activity,
                  title: "Visible permissions",
                  body: "Trading permissions and connection status are always displayed in your workspace.",
                },
              ].map((item) => (
                <article key={item.title} className="panel flex gap-3 p-4">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
                    <item.icon className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <KocelLogo showTagline />
            <p className="mt-3 max-w-xs text-xs text-muted-foreground">
              Kocel Forex Hub is an independent trading-management platform. It is not a broker and
              does not hold client funds.
            </p>
          </div>
          <FooterColumn
            title="Platform"
            links={[
              { label: "Features", href: "#features" },
              { label: "Supported Brokers", href: "#brokers" },
              { label: "Security", href: "#security" },
              { label: "About", href: "#how" },
            ]}
          />
          <FooterColumn
            title="Resources"
            links={[
              { label: "Terms", href: "#security" },
              { label: "Privacy", href: "#security" },
              { label: "Contact", href: "mailto:support@kocel.app" },
            ]}
          />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Account
            </h3>
            <div className="mt-3 flex flex-col gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link to="/login">Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/register">Create Account</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Kocel Forex Hub. Trading involves risk.
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((link) => (
          <li key={link.label}>
            <a href={link.href} className="text-foreground/80 hover:text-foreground">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DashboardPreview() {
  const rows = [
    { label: "Balance", value: "—" },
    { label: "Equity", value: "—" },
    { label: "Free margin", value: "—" },
    { label: "Margin level", value: "—" },
  ];

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <span className="text-xs font-semibold text-foreground">Kocel workspace</span>
        <span className="rounded border border-border px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Interface preview
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          {rows.map((row) => (
            <div key={row.label} className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
              <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                {row.label}
              </p>
              <p className="num mt-1 text-base font-semibold text-foreground">{row.value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-md border border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[0.68rem] font-medium text-muted-foreground">
            <span>Market watch</span>
            <span>Requires Bridge session</span>
          </div>
          <ul className="divide-y divide-border text-xs">
            {["EURUSD", "XAUUSD", "NAS100"].map((symbol) => (
              <li key={symbol} className="flex items-center justify-between px-3 py-2">
                <span className="num font-medium text-foreground">{symbol}</span>
                <span className="num text-muted-foreground">— / —</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[0.68rem] text-muted-foreground">
          Kocel never simulates prices or balances. Figures appear only when a connected MT5
          terminal reports them.
        </p>
      </div>
    </div>
  );
}
