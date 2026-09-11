import { describe, expect, it } from "vitest";

import { toApiError } from "@/lib/api/errors";

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

describe("settings error handling", () => {
  it("shows a session-expired message for auth failures", () => {
    const error = toApiError({ code: "PGRST301", message: "JWT expired" });

    expect(error.message).toBe("Your session has expired. Please sign in again.");
  });

  it("does not hide temporary database failures behind the generic settings message", () => {
    const error = toApiError({ code: "PGRST205", message: "relation \"user_settings\" does not exist" });

    expect(error.message).toBe("Unable to load Settings right now. Please try again.");
  });
});