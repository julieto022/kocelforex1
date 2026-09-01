import { afterAll, describe, expect, it } from "vitest";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { bridgeService } from "./bridge.server";

const integrationEnabled = Boolean(
  process.env["SUPABASE_URL"] &&
  process.env["SUPABASE_SERVICE_ROLE_KEY"] &&
  process.env["PUBLIC_APP_URL"],
);

const createdRequestIds: string[] = [];
let createdPollToken: string | undefined;

describe.skipIf(!integrationEnabled)("Bridge API integration", () => {
  it("registers arbitrary terminal identities and returns browser authorization handles", async () => {
    const identities = [
      {
        broker: "Exness Technologies Ltd",
        environment: "DEMO" as const,
        server: "Exness-MT5Trial9",
      },
      { broker: "Deriv Limited", environment: "REAL" as const, server: "Deriv-Server-03" },
      {
        broker: "Additional MT5 Broker Ltd",
        environment: "DEMO" as const,
        server: "AdditionalBroker-Demo",
      },
    ];
    const results = await Promise.all(
      identities.map((identity, index) =>
        bridgeService.register({
          mt5Login: `${Date.now() + index}`.slice(-8),
          server: identity.server,
          environment: identity.environment,
          broker: identity.broker,
          accountName: `Integration test account ${index + 1}`,
          currency: "USD",
          leverage: 100,
          eaVersion: "test-1.0.0",
          terminalBuild: "test-build",
          terminalName: "MetaTrader 5",
          terminalCompany: "MetaQuotes Ltd.",
        }),
      ),
    );
    results.forEach((result) => createdRequestIds.push(result.requestId));
    const result = results[0];
    if (!result) throw new Error("Bridge registration returned no result.");
    createdPollToken = result.pollToken;
    expect(result.authorizationUrl).toBe(
      `https://kocelforexhub.lovable.app/authorize/mt5/${result.requestId}`,
    );
    expect(result.pollToken).toMatch(/^[A-Za-z0-9_-]+$/);

    const { data, error } = await supabaseAdmin
      .from("mt5_authorization_requests")
      .select("poll_token_hash, status, environment")
      .eq("id", result.requestId)
      .single();
    expect(error).toBeNull();
    expect(data?.poll_token_hash).not.toBe(result.pollToken);
    expect(data?.status).toBe("WAITING_FOR_USER");
    expect(data?.environment).toBe("DEMO");

    const { data: registeredIdentities, error: identityError } = await supabaseAdmin
      .from("mt5_authorization_requests")
      .select("broker_hint, server, environment")
      .in(
        "id",
        results.map((item) => item.requestId),
      );
    expect(identityError).toBeNull();
    expect(registeredIdentities).toEqual(
      expect.arrayContaining(
        identities.map(({ broker, server, environment }) => ({
          broker_hint: broker,
          server,
          environment,
        })),
      ),
    );
  });

  it("returns pending status and rejects malformed or unknown poll handles", async () => {
    if (!createdPollToken) throw new Error("Bridge registration did not create a poll token.");
    await expect(bridgeService.pollAuthorization(createdPollToken)).resolves.toEqual({
      status: "WAITING_FOR_USER",
    });
    await expect(bridgeService.pollAuthorization("not-a-real-poll-token")).rejects.toThrow();
  });

  afterAll(async () => {
    if (createdRequestIds.length > 0) {
      await supabaseAdmin.from("mt5_authorization_requests").delete().in("id", createdRequestIds);
    }
  });
});
