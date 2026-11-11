import { createFileRoute } from "@tanstack/react-router";

import { logger } from "@/lib/api/logger";
import {
  authenticateMcpApiKey,
  createKocelMcpServer,
  createMcpTransport,
} from "@/lib/server/mcp.server";

function unauthorized() {
  return Response.json(
    { error: "A valid Kocel MCP bearer token is required." },
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="Kocel MCP"' },
    },
  );
}

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204 }),
      GET: async () =>
        new Response("This stateless MCP endpoint accepts JSON-RPC POST requests only.", {
          status: 405,
          headers: { Allow: "POST, OPTIONS" },
        }),
      DELETE: async () =>
        new Response("This stateless MCP endpoint does not maintain sessions.", {
          status: 405,
          headers: { Allow: "POST, OPTIONS" },
        }),
      POST: async ({ request }) => {
        let server: ReturnType<typeof createKocelMcpServer> | undefined;
        try {
          const key = await authenticateMcpApiKey(request);
          if (!key) return unauthorized();

          server = createKocelMcpServer(key);
          const transport = createMcpTransport();
          await server.connect(transport);
          return await transport.handleRequest(request);
        } catch (error) {
          logger.error("api", "MCP request failed", { error });
          return Response.json(
            { error: "The MCP request could not be completed." },
            { status: 500 },
          );
        } finally {
          if (server) await server.close();
        }
      },
    },
  },
});
