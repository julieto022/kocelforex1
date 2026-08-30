import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/components/kocel/auth-layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register } from "@/services/auth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your Kocel account — Kocel Forex Hub" },
      {
        name: "description",
        content:
          "Create a free Kocel Forex Hub account, then connect your MT5 broker accounts through the Kocel Bridge EA.",
      },
      { property: "og:title", content: "Create your Kocel account" },
      {
        property: "og:description",
        content: "One Kocel account, any supported MT5 broker.",
      },
    ],
  }),
  component: RegisterPage,
});

const schema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(120),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers and underscores only"),
    email: z.string().trim().email("Enter a valid email address").max(255),
    country: z.string().trim().min(2, "Enter your country").max(80),
    phone: z.string().trim().min(6, "Enter a valid phone number").max(30),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(200)
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[0-9]/, "Include a number"),
    confirmPassword: z.string(),
    referralCode: z.string().trim().max(40).optional(),
    accepted: z.literal(true, { message: "You must accept the terms to continue" }),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

const initialForm = {
  fullName: "",
  username: "",
  email: "",
  country: "",
  phone: "",
  password: "",
  confirmPassword: "",
  referralCode: "",
  accepted: false,
};

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      register({
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        country: form.country.trim(),
        phone: form.phone.trim(),
        referralCode: form.referralCode.trim() || undefined,
      }),
    onSuccess: (data) => {
      if (data.session) {
        toast.success("Account created");
        void navigate({ to: "/onboarding", replace: true });
        return;
      }
      setPendingEmail(form.email.trim());
    },
    onError: (error: Error) => toast.error(error.message || "We couldn't create your account"),
  });

  if (pendingEmail) {
    return (
      <AuthLayout
        title="Confirm your email"
        description="Your Kocel account is created but not active yet."
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-md border border-border bg-muted/40 p-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{pendingEmail}</span>. Open it to
              activate your account, then sign in.
            </p>
          </div>
          <Button className="w-full" asChild>
            <Link to="/login">Go to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const field = (key: keyof typeof initialForm) => ({
    value: String(form[key]),
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <AuthLayout
      title="Create your Kocel account"
      description="Kocel is broker-independent. You'll connect MT5 brokers after signing up."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
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
        <Field label="Full name" id="fullName" error={errors["fullName"]}>
          <Input id="fullName" autoComplete="name" {...field("fullName")} />
        </Field>
        <Field label="Username" id="username" error={errors["username"]}>
          <Input id="username" autoComplete="username" {...field("username")} />
        </Field>
        <Field label="Email" id="email" error={errors["email"]}>
          <Input id="email" type="email" autoComplete="email" {...field("email")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country" id="country" error={errors["country"]}>
            <Input id="country" autoComplete="country-name" {...field("country")} />
          </Field>
          <Field label="Phone" id="phone" error={errors["phone"]}>
            <Input id="phone" type="tel" autoComplete="tel" {...field("phone")} />
          </Field>
        </div>
        <Field label="Password" id="password" error={errors["password"]}>
          <Input id="password" type="password" autoComplete="new-password" {...field("password")} />
        </Field>
        <Field label="Confirm password" id="confirmPassword" error={errors["confirmPassword"]}>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...field("confirmPassword")}
          />
        </Field>
        <Field label="Referral code (optional)" id="referralCode" error={errors["referralCode"]}>
          <Input id="referralCode" {...field("referralCode")} />
        </Field>

        <div className="flex items-start gap-2.5">
          <Checkbox
            id="accepted"
            checked={form.accepted}
            onCheckedChange={(checked) => setForm({ ...form, accepted: checked === true })}
          />
          <Label
            htmlFor="accepted"
            className="text-xs font-normal leading-relaxed text-muted-foreground"
          >
            I accept the Kocel terms of service and understand that Kocel is not a broker and does
            not hold funds. Trading involves risk.
          </Label>
        </div>
        {errors["accepted"] && <p className="text-xs text-destructive">{errors["accepted"]}</p>}

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
