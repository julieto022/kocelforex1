import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { PageHeader } from "@/components/kocel/page-header";
import { EmptyState, ErrorState, SectionCard, TableSkeleton } from "@/components/kocel/states";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getNotifications, markAllRead } from "@/services/notifications";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => getNotifications(user!.id),
    enabled: Boolean(user?.id),
  });

  const markAll = useMutation({
    mutationFn: () => markAllRead(user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const items = notificationsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Connection, bot and trading alerts from your Kocel workspace."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending || items.length === 0}
          >
            Mark all read
          </Button>
        }
      />

      <SectionCard title="All notifications" bodyClassName="p-0 sm:p-0">
        {notificationsQuery.isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={5} cols={2} />
          </div>
        ) : notificationsQuery.isError ? (
          <ErrorState onRetry={() => void notificationsQuery.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="Alerts appear here as your connections and bots report events."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {!item.read && <span className="size-2 rounded-full bg-primary" />}
                </div>
                {item.message && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                )}
                <p className="num mt-1 text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
