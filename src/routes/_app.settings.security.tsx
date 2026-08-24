import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { SectionCard } from "@/components/kocel/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/services/auth";

export const Route = createFileRoute("/_app/settings/security")({
  component: SecuritySettings,
});

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(200)
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[0-9]/, "Include a number"),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

function SecuritySettings() {
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => updatePassword(form.password),
    onSuccess: () => {
      setForm({ password: "", confirmPassword: "" });
      toast.success("Password updated");
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  return (
    <div className="space-y-5">
      <SectionCard title="Change password" description="Applies to your Kocel account only.">
        <form
          className="max-w-xl space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = schema.safeParse(form);
            if (!parsed.success) {
              setError(parsed.error.issues[0]?.message ?? "Check your password");
              return;
            }
            setError(null);
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Account separation">
        <div className="flex gap-3 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            Your Kocel password is never used to log in to a broker, and your broker credentials
            should never be used here. MT5 connectivity happens only through the Kocel Bridge EA.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
