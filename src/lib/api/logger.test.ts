import { describe, expect, it } from "vitest";

import { __redact } from "./logger";

describe("log redaction", () => {
  it("redacts secret-bearing keys anywhere in the payload", () => {
    const redacted = __redact({
      mt5_login: "51234567",
      password: "hunter2",
      connection_code: "KCL-AAAA-BBBB",
      nested: {
        authorization: "Bearer abc",
        bridge_token: "tok",
        safe: "keep",
      },
      list: [{ session_token_hash: "x", symbol: "XAUUSD" }],
    }) as Record<string, unknown>;

    expect(redacted["mt5_login"]).toBe("51234567");
    expect(redacted["password"]).toBe("[redacted]");
    expect(redacted["connection_code"]).toBe("[redacted]");
    expect(redacted["nested"]).toEqual({
      authorization: "[redacted]",
      bridge_token: "[redacted]",
      safe: "keep",
    });
    expect(redacted["list"]).toEqual([{ session_token_hash: "[redacted]", symbol: "XAUUSD" }]);
  });

  it("is case-insensitive and depth limited", () => {
    expect((__redact({ Password: "x" }) as Record<string, unknown>)["Password"]).toBe("[redacted]");
    let deep: unknown = "leaf";
    for (let i = 0; i < 10; i += 1) deep = { deep };
    expect(JSON.stringify(__redact(deep))).toContain("[depth-limit]");
  });
});
