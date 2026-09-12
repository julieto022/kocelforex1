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

  it("shows the missing table migration message for user_settings schema errors", () => {
    const error = toApiError({ code: "PGRST205", message: "relation \"user_settings\" does not exist" });

    expect(error.message).toBe(
      "The user_settings table is missing or not migrated yet. Please apply the Supabase migration for user_settings.",
    );
  });

  it("shows the migration message for missing trading risk settings schema", () => {
    const error = toApiError({ code: "42P01", message: "relation \"trading_risk_settings\" does not exist" });

    expect(error.message).toBe(
      "The Trading Risk Settings table is missing or not migrated yet. Please apply the Supabase migration for trading_risk_settings.",
    );
  });
});