import { createFileRoute } from "@tanstack/react-router";

import { ok } from "@/lib/api/response";

/** Liveness probe. Returns no user data and touches no user tables. */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () =>
        ok({ service: "kocel-api", status: "ok", time: new Date().toISOString() }, "Healthy"),
    },
  },
});
