import { describe, expect, it } from "vitest";

import { settingsSchema } from "./settings.functions";

describe("settings save validation", () => {
  it("accepts the lowercase risk-profile values sent by the Trading Settings UI", () => {
    const result = settingsSchema.parse({ default_risk_profile: "balanced" });

    expect(result.default_risk_profile).toBe("BALANCED");
  });

  it("rejects unsupported risk profiles", () => {
    expect(() => settingsSchema.parse({ default_risk_profile: "unsafe" })).toThrow();
  });
});