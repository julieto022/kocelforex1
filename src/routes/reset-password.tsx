import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/components/kocel/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/services/auth";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — Kocel Forex Hub" },
      { name: "description", content: "Choose a new password for your Kocel Forex Hub account." },
      { property: "og:title", content: "Set a new password — Kocel Forex Hub" },
      { property: "og:description", content: "Complete your Kocel password reset." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
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

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => updatePassword(form.password),
    onSuccess: () => {
      toast.success("Password updated");
      void navigate({ to: "/dashboard", replace: true });
    },
    onError: (error: Error) => toast.error(error.message || "We couldn't update your password"),
  });

  return (
    <AuthLayout title="Set a new password" description="Choose a strong password for Kocel.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = schema.safeParse(form);
          if (!parsed.success) {
            const next: Record<string, string> = {};
            for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
            setErrors(next);
            return;
          }
          setErrors({});
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
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
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
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword}</p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
