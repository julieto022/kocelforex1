import { supabase } from "@/integrations/supabase/client";
import type { Broker } from "./types";

/** Broker-agnostic catalog read. No broker-specific branching anywhere in the app. */
export async function getBrokerList(): Promise<Broker[]> {
  const { data, error } = await supabase
    .from("brokers")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Broker[];
}

export function brokerStatusLabel(broker: Pick<Broker, "status" | "supported">) {
  if (broker.status === "coming_soon") return "Coming soon";
  if (broker.status === "manual") return "Manual configuration";
  return broker.supported ? "Supported" : "Coming soon";
}
