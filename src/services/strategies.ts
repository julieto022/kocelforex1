import { supabase } from "@/integrations/supabase/client";
import type { Strategy } from "./types";

export async function getStrategies(): Promise<Strategy[]> {
  const { data, error } = await supabase
    .from("strategies")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Strategy[];
}
