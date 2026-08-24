import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/components/kocel/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { login } from "@/services/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Kocel Forex Hub" },
      {
        name: "description",
        content: "Sign in to your Kocel Forex Hub account to manage your connected MT5 brokers.",
      },
      { property: "og:title", content: "Sign in — Kocel Forex Hub" },
      {
        property: "og:description",
        content: "Access your Kocel workspace and connected MT5 broker accounts.",
      },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(1, "Enter your password").max(200),
});

function LoginPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (session) void navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  const mutation = useMutation({
    mutationFn: () => login(form.email.trim(), form.password),
    onSuccess: () => {
      toast.success("Welcome back to Kocel");
      void navigate({ to: "/dashboard", replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || "We couldn't sign you in");
    },
  });

  return (
    <AuthLayout
      title="Sign in to Kocel"
      description="Your Kocel account is separate from your broker login."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
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
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="you@example.com"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Sign in
        </Button>

        <p className="text-xs text-muted-foreground">
          Never enter your MT5 broker password here. Kocel connects to brokers through the Bridge
          EA only.
        </p>
      </form>
    </AuthLayout>
  );
}
