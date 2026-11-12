import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SectionCard } from "@/components/kocel/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getFollowCounts } from "@/services/community";
import { updateProfile } from "@/services/users";
import type { Profile } from "@/services/types";

export const Route = createFileRoute("/_app/settings/profile")({
  component: ProfileSettings,
});

function ProfileSettings() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ full_name: "", username: "", phone: "", country: "" });
  const fileInput = useRef<HTMLInputElement>(null);
  const communityCounts = useQuery({
    queryKey: ["community-follow-counts", user?.id],
    queryFn: () => getFollowCounts(user!.id),
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      username: profile.username ?? "",
      phone: profile.phone ?? "",
      country: profile.country ?? "",
    });
  }, [profile]);

  async function applySavedProfile(savedProfile: Profile) {
    if (!user) return;
    queryClient.setQueryData(["profile", user.id], savedProfile);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["community-author"] }),
      queryClient.invalidateQueries({ queryKey: ["community-posts"] }),
      queryClient.invalidateQueries({ queryKey: ["community-comments"] }),
      queryClient.invalidateQueries({ queryKey: ["community-members"] }),
      queryClient.invalidateQueries({ queryKey: ["dash-community"] }),
    ]);
  }

  const mutation = useMutation({
    mutationFn: () =>
      updateProfile(user!.id, {
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        phone: form.phone.trim(),
        country: form.country.trim(),
      }),
    onSuccess: async (savedProfile) => {
      await applySavedProfile(savedProfile);
      setForm({
        full_name: savedProfile.full_name ?? "",
        username: savedProfile.username ?? "",
        phone: savedProfile.phone ?? "",
        country: savedProfile.country ?? "",
      });
      toast.success("Profile updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Sign in to upload a profile picture.");
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Choose a JPG, PNG, or WebP image.");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Profile pictures must be 5 MB or smaller.");
      }

      const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const path = `${user.id}/profile-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000",
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      return updateProfile(user.id, { avatar_url: data.publicUrl });
    },
    onSuccess: async (savedProfile) => {
      await applySavedProfile(savedProfile);
      toast.success("Profile picture updated.");
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
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="Profile picture" />}
            <AvatarFallback className="bg-primary/15 text-base font-semibold text-primary">
              {(profile?.full_name || profile?.username || "K")
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() ?? "")
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-sm font-medium">Profile picture</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, or WebP; up to 5 MB.</p>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Choose profile picture"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) avatarMutation.mutate(file);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={avatarMutation.isPending}
              onClick={() => fileInput.current?.click()}
            >
              {avatarMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-2 size-4" />
              )}
              Upload picture
            </Button>
          </div>
        </div>
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
          <Input id="email" value={user?.email ?? profile?.email ?? ""} disabled />
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

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Community profile</h3>
            <p className="text-xs text-muted-foreground">
              Your public identity, followers, and shared trading discussions.
            </p>
          </div>
          {user && (
            <Button size="sm" variant="outline" asChild>
              <Link to="/community/$userId" params={{ userId: user.id }}>
                View profile
              </Link>
            </Button>
          )}
        </div>
        <div className="mt-3 grid max-w-sm grid-cols-2 gap-3">
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Followers</p>
            <p className="num mt-1 text-lg font-semibold text-foreground">
              {communityCounts.data?.followers ?? 0}
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Following</p>
            <p className="num mt-1 text-lg font-semibold text-foreground">
              {communityCounts.data?.following ?? 0}
            </p>
          </div>
        </div>
        {communityCounts.isError && (
          <p className="mt-2 text-xs text-destructive" role="alert">
            Community counts could not be loaded.
          </p>
        )}
      </div>
    </SectionCard>
  );
}
