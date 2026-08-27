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
  it("registers a terminal identity and returns a browser authorization handle", async () => {
    const result = await bridgeService.register({
      mt5Login: `${Date.now()}`.slice(-8),
      server: "Kocel-Test-Demo",
      environment: "DEMO",
      broker: "Kocel Test Broker",
      accountName: "Integration test account",
      eaVersion: "test-1.0.0",
      terminalBuild: "test-build",
    });
    createdRequestIds.push(result.requestId);
    createdPollToken = result.pollToken;
    expect(result.authorizationUrl).toBe(
      `${process.env["PUBLIC_APP_URL"]}/authorize/mt5/${result.requestId}`,
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
  });

  it("returns pending status and rejects malformed or unknown poll handles", async () => {
    expect(createdPollToken).toBeTruthy();
    await expect(bridgeService.pollAuthorization(createdPollToken!)).resolves.toEqual({
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
