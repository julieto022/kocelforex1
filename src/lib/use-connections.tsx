import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useAuth } from "@/lib/auth";
import { getMT5Connections } from "@/services/mt5";
import type { BrokerConnection } from "@/services/types";

const ACTIVE_KEY = "kocel.activeConnection";

type ConnectionsContextValue = {
  connections: BrokerConnection[];
  active: BrokerConnection | null;
  setActiveId: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

const ConnectionsContext = createContext<ConnectionsContextValue | null>(null);

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeId, setActiveIdState] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["connections", user?.id],
    queryFn: () => getMT5Connections(user!.id),
    enabled: Boolean(user?.id),
    refetchInterval: 5_000,
  });

  useEffect(() => {
    setActiveIdState(localStorage.getItem(ACTIVE_KEY));
  }, []);

  const connections = query.data ?? [];
  const active =
    connections.find((connection) => connection.id === activeId) ?? connections[0] ?? null;

  const value = useMemo<ConnectionsContextValue>(
    () => ({
      connections,
      active,
      isLoading: query.isLoading,
      isError: query.isError,
      refetch: () => void query.refetch(),
      setActiveId: (id: string) => {
        localStorage.setItem(ACTIVE_KEY, id);
        setActiveIdState(id);
      },
    }),
    [connections, active, query],
  );

  return <ConnectionsContext.Provider value={value}>{children}</ConnectionsContext.Provider>;
}

export function useConnections() {
  const context = useContext(ConnectionsContext);
  if (!context) throw new Error("useConnections must be used inside ConnectionsProvider");
  return context;
}
