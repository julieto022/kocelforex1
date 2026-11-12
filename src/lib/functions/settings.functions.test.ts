import { describe, expect, it } from "vitest";

import { toApiError } from "@/lib/api/errors";

import { profileSchema, settingsSchema } from "./settings.functions";

describe("settings save validation", () => {
  it("accepts the lowercase risk-profile values sent by the Trading Settings UI", () => {
    const result = settingsSchema.parse({ default_risk_profile: "balanced" });

    expect(result.default_risk_profile).toBe("BALANCED");
  });

  describe("profile save validation", () => {
    it("accepts profile field lengths supported by registration", () => {
      const profile = profileSchema.parse({
        full_name: "A".repeat(120),
        username: "user_123",
        phone: "1".repeat(30),
        country: "C".repeat(80),
      });

      expect(profile.full_name).toHaveLength(120);
      expect(profile.phone).toHaveLength(30);
      expect(profile.country).toHaveLength(80);
    });

    it("enforces registration's username format", () => {
      expect(() => profileSchema.parse({ username: "user-name" })).toThrow();
      expect(profileSchema.parse({ username: "user_name" }).username).toBe("user_name");
    });
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
    const error = toApiError({
      code: "PGRST205",
      message: 'relation "user_settings" does not exist',
    });

    expect(error.message).toBe(
      "The user_settings table is missing or not migrated yet. Please apply the Supabase migration for user_settings.",
    );
  });

  it("shows the migration message for missing trading risk settings schema", () => {
    const error = toApiError({
      code: "42P01",
      message: 'relation "trading_risk_settings" does not exist',
    });

    expect(error.message).toBe(
      "The Trading Risk Settings table is missing or not migrated yet. Please apply the Supabase migration for trading_risk_settings.",
    );
  });
});
