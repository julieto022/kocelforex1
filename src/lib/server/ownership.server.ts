import type { SupabaseClient } from "@supabase/supabase-js";

import { notFound } from "@/lib/api/errors";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/**
 * Tables whose rows belong to exactly one Kocel user.
 * Ownership is enforced here AND by row-level security in the database.
 */
export type OwnedTable =
  | "broker_connections"
  | "bridge_sessions"
  | "bots"
  | "trades"
  | "signals"
  | "notifications"
  | "community_posts"
  | "community_comments"
  | "market_symbols";

/**
 * Verifies that `id` exists AND belongs to `userId`.
 *
 * Deliberately returns NOT_FOUND rather than FORBIDDEN for someone else's row:
 * a 403 would confirm the id exists, which is an enumeration oracle.
 */
export async function requireOwnership(
  supabase: Client,
  table: OwnedTable,
  id: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from(table)
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data || data.user_id !== userId) throw notFound();
}

/** Guards a broker_connection reference supplied by the client. */
export async function requireConnectionOwnership(
  supabase: Client,
  connectionId: string | null | undefined,
  userId: string,
): Promise<void> {
  if (!connectionId) return;
  await requireOwnership(supabase, "broker_connections", connectionId, userId);
}
