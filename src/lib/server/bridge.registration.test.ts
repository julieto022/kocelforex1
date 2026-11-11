import { describe, expect, it } from "vitest";

import { resolveBridgeBrokerHint } from "./bridge.server";

describe("resolveBridgeBrokerHint", () => {
  it("uses the terminal server when the broker company is missing", () => {
    expect(resolveBridgeBrokerHint(null, "Broker-Demo")).toBe("Broker-Demo");
    expect(resolveBridgeBrokerHint("   ", "Broker-Live")).toBe("Broker-Live");
  });

  it("preserves the detected broker company when available", () => {
    expect(resolveBridgeBrokerHint("  Example Broker Ltd  ", "Broker-Demo")).toBe(
      "Example Broker Ltd",
    );
  });
});
