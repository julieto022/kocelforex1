import { beforeAll, describe, expect, it } from "vitest";

import {
  hashSecretValue,
  randomToken,
  signBridgeToken,
  timingSafeEquals,
  verifyBridgeToken,
} from "./crypto.server";

beforeAll(() => {
  process.env["CONNECTION_CODE_PEPPER"] = "test-pepper";
  process.env["BRIDGE_TOKEN_SECRET"] = "test-bridge-secret";
});

describe("secret hashing", () => {
  it("hashes deterministically and never returns the plaintext", async () => {
    const token = randomToken();
    const hash = await hashSecretValue(token);
    expect(hash).toBe(await hashSecretValue(token));
    expect(hash).not.toContain(token);
    expect(hash).not.toBe(await hashSecretValue(`${token}x`));
  });
});

describe("timingSafeEquals", () => {
  it("compares values correctly", () => {
    expect(timingSafeEquals("abc", "abc")).toBe(true);
    expect(timingSafeEquals("abc", "abd")).toBe(false);
    expect(timingSafeEquals("abc", "abcd")).toBe(false);
  });
});

describe("randomToken", () => {
  it("returns url-safe unique tokens", () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).not.toBe(randomToken());
  });
});

describe("bridge tokens", () => {
  const claims = {
    cid: "11111111-1111-1111-1111-111111111111",
    uid: "22222222-2222-2222-2222-222222222222",
    login: "51234567",
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  it("round-trips signed claims", async () => {
    const token = await signBridgeToken(claims);
    expect(await verifyBridgeToken(token)).toEqual(claims);
  });

  it("rejects a tampered payload", async () => {
    const token = await signBridgeToken(claims);
    const parts = token.split(".") as [string, string];
    expect(await verifyBridgeToken(`${parts[0]}x.${parts[1]}`)).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    expect(await verifyBridgeToken("not-a-token")).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const expired = await signBridgeToken({
      ...claims,
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    expect(await verifyBridgeToken(expired)).toBeNull();
  });
});
