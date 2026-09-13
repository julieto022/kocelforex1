import { describe, expect, it } from "vitest";

import { toApiError, toBotApiError } from "./errors";

describe("bot API error mapping", () => {
  it("does not use the Settings message for bot insert failures", () => {
    const error = toBotApiError({
      code: "23503",
      message: "insert or update on table bots violates foreign key constraint",
    });

    expect(error.message).toBe("The selected strategy or MT5 account is no longer available.");
    expect(error.message).not.toContain("Settings");
  });

  it("maps bot RLS failures to a bot-specific permission error", () => {
    expect(toBotApiError({ code: "42501", message: "new row violates row-level security policy" }).message).toBe(
      "You do not have permission to create or update this bot.",
    );
  });

  it("keeps the Settings mapper scoped to Settings operations", () => {
    expect(toApiError({ code: "PGRST205", message: "relation user_settings does not exist" }).message).toContain(
      "user_settings",
    );
  });
});
