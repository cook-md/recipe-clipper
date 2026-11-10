/**
 * Whether a session token (a JWT) is past its `exp`. `now` is in milliseconds,
 * `exp` in seconds. The signature is not checked: this only saves a request
 * with a token the server is certain to refuse.
 *
 * A token with no readable `exp` counts as not expired (the server decides);
 * a token that isn't a JWT at all counts as expired.
 */
export function tokenExpired(token: string, now: number): boolean {
  const payload = readPayload(token);
  if (!payload) return true;
  const { exp } = payload;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return false;
  return exp * 1000 <= now;
}

function readPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    // base64url → base64: "-" and "_" stand for "+" and "/", and the padding is dropped.
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const json = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
    const payload: unknown = JSON.parse(json);
    return payload !== null && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
