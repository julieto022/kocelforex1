import type { NotificationType } from "@/lib/api/constants";
import { logger } from "@/lib/api/logger";

/**
 * Server-side notification writer. Notifications are a side effect of business
 * events, so a failed insert is logged rather than failing the parent action.
 */
export async function pushNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      message: input.message ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
    });
    if (error) throw error;
  } catch (error) {
    logger.warn("system", "notification insert failed", {
      type: input.type,
      error: String(error),
    });
  }
}
