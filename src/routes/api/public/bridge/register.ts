import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ok } from "@/lib/api/response";
import { bridgeService } from "@/lib/server/bridge.server";
import { preflight, readJson, toErrorResponse } from "@/lib/server/bridge-http.server";
import { enforceRateLimit } from "@/lib/server/rate-limit.server";

const schema = z.object({
  mt5Login: z
    .string()
    .trim()
    .regex(/^[0-9]{4,20}$/),
  server: z.string().trim().min(2).max(120),
  environment: z.enum(["DEMO", "REAL"]).nullish(),
  broker: z.string().trim().max(120).nullish(),
  accountName: z.string().trim().max(80).nullish(),
  eaVersion: z.string().trim().min(1).max(20),
  terminalBuild: z.string().trim().max(20).nullish(),
});

/** Step 1: create a browser authorization request for the EA's terminal identity. */
export const Route = createFileRoute("/api/public/bridge/register")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const body = await readJson(request, schema);
          await enforceRateLimit("bridgeRegister", body.mt5Login);
          const result = await bridgeService.register({
            mt5Login: body.mt5Login,
            server: body.server,
            environment: body.environment ?? null,
            broker: body.broker ?? null,
            accountName: body.accountName ?? null,
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
