import { z } from "zod";

export const mt5SnapshotDtoSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  broker_connection_id: z.string().uuid(),
  mt5_login: z.string(),
  status: z.string(),
  balance: z.number().finite(),
  equity: z.number().finite(),
  credit: z.number().finite(),
  margin: z.number().finite(),
  free_margin: z.number().finite(),
  margin_level: z.number().finite().nullable(),
  profit: z.number().finite(),
  currency: z.string().min(3).max(8),
  leverage: z.number().int().nullable(),
  snapshot_at: z.string().datetime(),
});

export type Mt5SnapshotDto = z.infer<typeof mt5SnapshotDtoSchema>;
