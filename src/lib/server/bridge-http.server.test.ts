import { describe, expect, it } from "vitest";
import { z } from "zod";

import { toErrorResponse } from "./bridge-http.server";

describe("toErrorResponse", () => {
  it("includes the invalid field in validation messages", async () => {
    const parsed = z.object({ mt5Login: z.string() }).safeParse({});
    if (parsed.success) throw new Error("Expected validation to fail.");

    const response = toErrorResponse(parsed.error);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "mt5Login: Required" },
    });
  });
});
