import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/kocel/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { updateProfile } from "@/services/users";

export const Route = createFileRoute("/_app/settings/profile")({
  component: ProfileSettings,
});

function ProfileSettings() {
  const { user, profile, refresh } = useAuth();
  const [form, setForm] = useState({ full_name: "", username: "", phone: "", country: "" });

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      username: profile.username ?? "",
      phone: profile.phone ?? "",
      country: profile.country ?? "",
    });
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () =>
      updateProfile(user!.id, {
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        phone: form.phone.trim(),
        country: form.country.trim(),
      }),
    onSuccess: () => {
      refresh();
      toast.success("Profile updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <SectionCard title="Profile" description="Details shown across your Kocel workspace.">
      <form
        className="max-w-xl space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input
            id="full_name"
            value={form.full_name}
            maxLength={120}
            onChange={(event) => setForm({ ...form, full_name: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={form.username}
            maxLength={30}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={profile?.email ?? user?.email ?? ""} disabled />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              maxLength={30}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={form.country}
              maxLength={80}
              onChange={(event) => setForm({ ...form, country: event.target.value })}
            />
          </div>
        </div>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save changes
        </Button>
      </form>
    </SectionCard>
  );
}
