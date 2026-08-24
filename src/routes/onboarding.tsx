import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, PlugZap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BridgeExplainer, BridgeStepList } from "@/components/kocel/bridge-steps";
import { KocelLogo } from "@/components/kocel/brand";
import { ConnectWizard } from "@/components/kocel/connect-wizard";
import { ThemeToggle } from "@/components/kocel/theme-toggle";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { useConnections } from "@/lib/use-connections";
import { completeOnboarding } from "@/services/users";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Get started — Kocel Forex Hub" },
      {
        name: "description",
        content: "Set up your Kocel workspace and connect your first MT5 broker account.",
      },
      { property: "og:title", content: "Get started — Kocel Forex Hub" },
      { property: "og:description", content: "Connect your first MT5 broker to Kocel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

const totalSteps = 3;

function OnboardingPage() {
  const navigate = useNavigate();
  const { session, profile, user, initializing, refresh } = useAuth();
  const { connections } = useConnections();
  const [step, setStep] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (!initializing && !session) void navigate({ to: "/login", replace: true });
  }, [initializing, session, navigate]);

  const finish = useMutation({
    mutationFn: async () => {
      if (user) await completeOnboarding(user.id);
    },
    onSuccess: () => {
      refresh();
      toast.success("You're all set");
      void navigate({ to: "/dashboard", replace: true });
    },
    onError: (error: Error) => toast.error(error.message || "We couldn't finish setup"),
  });

  return (
    <div className="relative min-h-screen bg-background">
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
        <div className="flex items-center justify-between">
          <KocelLogo />
          <ThemeToggle />
        </div>

        <div className="mt-8 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Step {step} of {totalSteps}
          </p>
          <Progress value={(step / totalSteps) * 100} className="mt-2 h-1.5" />

          <div className="panel mt-5 p-5">
            {step === 1 && (
              <div className="space-y-4">
                <h1 className="text-xl font-semibold text-foreground">
                  Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Kocel Forex Hub is a broker-independent workspace. Your Kocel account stays
                  separate from every broker, and you connect the MT5 accounts you want Kocel to
                  work with.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    "Monitor all connected MT5 accounts in one place",
                    "Apply Kocel strategies and bots to a chosen account",
                    "Keep full control — disconnect any account at any time",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h1 className="text-xl font-semibold text-foreground">How the connection works</h1>
                <BridgeExplainer />
                <BridgeStepList />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h1 className="text-xl font-semibold text-foreground">
                  Connect your first MT5 account
                </h1>
                <p className="text-sm text-muted-foreground">
                  You can do this now or later from Settings → MT5 Accounts.
                </p>
                {connections.length > 0 ? (
                  <div className="flex gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      {connections.length} MT5 account{connections.length > 1 ? "s" : ""} added.
                      Bridge status will update once your terminal reports in.
                    </span>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setWizardOpen(true)}>
                    <PlugZap className="mr-2 size-4" />
                    Connect MT5 account
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => setStep((current) => Math.max(1, current - 1))}
              disabled={step === 1}
            >
              Back
            </Button>
            {step < totalSteps ? (
              <Button onClick={() => setStep((current) => current + 1)}>Continue</Button>
            ) : (
              <Button onClick={() => finish.mutate()} disabled={finish.isPending}>
                {finish.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Go to dashboard
              </Button>
            )}
          </div>
        </div>
      </div>

      <ConnectWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
