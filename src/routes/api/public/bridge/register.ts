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
  server: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .refine((value) => !/[\u0000-\u001F\u007F]/.test(value), "Invalid server value"),
  environment: z.enum(["DEMO", "REAL"]),
  broker: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine((value) => !/[\u0000-\u001F\u007F]/.test(value), "Invalid broker value"),
  accountName: z.string().trim().max(80).nullish(),
  currency: z.string().trim().min(1).max(8).nullish(),
  leverage: z.number().int().min(0).max(10_000).nullish(),
  eaVersion: z.string().trim().min(1).max(20),
  terminalBuild: z.string().trim().max(20).nullish(),
  terminalName: z.string().trim().max(80).nullish(),
  terminalCompany: z.string().trim().max(120).nullish(),
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
            environment: body.environment,
            broker: body.broker,
            accountName: body.accountName ?? null,
            currency: body.currency ?? null,
            leverage: body.leverage ?? null,
            eaVersion: body.eaVersion,
            terminalBuild: body.terminalBuild ?? null,
            terminalName: body.terminalName ?? null,
            terminalCompany: body.terminalCompany ?? null,
          });
          return ok(result, "Bridge registered");
        } catch (error) {
          return toErrorResponse(error);
        }
      },
    },
  },
});
