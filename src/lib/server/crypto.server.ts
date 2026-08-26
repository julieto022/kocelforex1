/**
 * Server-only cryptography. Uses Web Crypto, which the edge runtime provides.
 * Nothing here is ever imported into browser code.
 */

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(bytes);
  return bytes;
}

function toBase64Url(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Cryptographically secure opaque token, e.g. for session or reset records. */
export function randomToken(byteLength = 32): string {
  return toBase64Url(randomBytes(byteLength));
}

async function sha256(input: string): Promise<Uint8Array<ArrayBuffer>> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return new Uint8Array(digest);
}

/**
 * One-way hash for values we must be able to look up but never read back:
 * authorization poll tokens, session identifiers, password-reset tokens.
 */
export async function hashSecretValue(value: string): Promise<string> {
  const pepper = process.env["CONNECTION_CODE_PEPPER"] ?? "";
  return toBase64Url(await sha256(`${pepper}:${value}`));
}

export function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type BridgeTokenClaims = {
  /** Broker connection id the Bridge EA is bound to. */
  cid: string;
  /** Owning Kocel user id. */
  uid: string;
  /** MT5 login the EA reported; every later call must match it. */
  login: string;
  /** Expiry, seconds since epoch. */
  exp: number;
};

function bridgeSecret(): string {
  const secret = process.env["BRIDGE_TOKEN_SECRET"];
  if (!secret) throw new Error("BRIDGE_TOKEN_SECRET is not configured");
  return secret;
}

/**
 * Signs a short-lived Bridge session token. The EA never sends a bare user id —
 * it must present this signed token, which the backend issued after a valid
 * single-use connection code was claimed.
 */
export async function signBridgeToken(claims: BridgeTokenClaims): Promise<string> {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const key = await hmacKey(bridgeSecret());
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyBridgeToken(token: string): Promise<BridgeTokenClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts as [string, string];
  const key = await hmacKey(bridgeSecret());
  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(payload),
    );
  } catch {
    return null;
  }
  if (!valid) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as BridgeTokenClaims;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return null;
    if (!claims.cid || !claims.uid || !claims.login) return null;
    return claims;
  } catch {
    return null;
  }
}
