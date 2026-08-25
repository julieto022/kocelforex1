import { describe, expect, it } from "vitest";

import { ERROR_CODES, fail, ok, type ApiEnvelope } from "./response";

describe("API envelope", () => {
  it("wraps successful data", async () => {
    const response = ok({ id: "abc" }, "Created", 201);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as ApiEnvelope<{ id: string }>;
    expect(body).toEqual({ success: true, data: { id: "abc" }, message: "Created" });
  });

  it("maps error codes to their default HTTP status", async () => {
    for (const [code, status] of Object.entries(ERROR_CODES)) {
      const response = fail(code as keyof typeof ERROR_CODES, "nope");
      expect(response.status).toBe(status);
    }
  });

  it("allows an explicit status override", async () => {
    const response = fail("CONFLICT", "already claimed", 418);
    expect(response.status).toBe(418);
    const body = (await response.json()) as ApiEnvelope<never>;
    expect(body).toEqual({
      success: false,
      error: { code: "CONFLICT", message: "already claimed" },
    });
  });
});
