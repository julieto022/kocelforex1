import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ok } from "@/lib/api/response";
import { bridgeService } from "@/lib/server/bridge.server";
import { preflight, readJson, toErrorResponse } from "@/lib/server/bridge-http.server";
import { enforceRateLimit } from "@/lib/server/rate-limit.server";

const schema = z.object({
  code: z.string().trim().regex(/^KCL-[A-Z0-9]{4}-[A-Z0-9]{4}$/i, "Invalid connection code."),
  mt5Login: z.string().trim().regex(/^[0-9]{4,20}$/),
  server: z.string().trim().min(2).max(120),
  eaVersion: z.string().trim().min(1).max(20),
  terminalBuild: z.string().trim().max(20).nullish(),
});

/** Step 1 of the Bridge handshake: exchange a pairing code for a session token. */
export const Route = createFileRoute("/api/public/bridge/register")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const body = await readJson(request, schema);
          await enforceRateLimit("bridgeRegister", body.mt5Login);
          const result = await bridgeService.register({
            code: body.code,
            mt5Login: body.mt5Login,
            server: body.server,
            eaVersion: body.eaVersion,
            terminalBuild: body.terminalBuild ?? null,
          });
          return ok(result, "Bridge registered");
        } catch (error) {
          return toErrorResponse(error);
        }
      },
    },
  },
});
