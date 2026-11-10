export const API_BASE = "https://cook.md";
const REQUEST_TIMEOUT_MS = 60_000;
const UNREACHABLE = "Couldn't reach cook.md. Check your connection and try again.";

export type Client = "extension_chrome" | "extension_firefox" | "extension_safari";
type FetchFn = (input: string, init?: any) => Promise<Response>;

export interface ConvertPayload {
  text: string;
  sourceUrl: string;
  client: Client;
  /** Present when the wasm extractors found the recipe: the server skips its own extraction. */
  extracted?: { name: string; metadata: string };
}

export type ConvertResult =
  | { kind: "ok"; cooklang: string }
  | { kind: "rate_limited"; retryAfter: number }
  /** 401: the token was not accepted. */
  | { kind: "unauthorized" }
  | { kind: "error"; message: string };

export type CodeResult = { kind: "sent" } | { kind: "error"; message: string };
export type VerifyResult = { kind: "ok"; token: string } | { kind: "error"; message: string };

/** `import.meta.env.BROWSER` → the `client` value the server records. */
export function clientFor(browserName: string): Client {
  if (browserName === "firefox") return "extension_firefox";
  if (browserName === "safari") return "extension_safari";
  return "extension_chrome";
}

export async function convert(payload: ConvertPayload, token?: string, fetchFn: FetchFn = fetch): Promise<ConvertResult> {
  const body: Record<string, unknown> = {
    text: payload.text,
    source_url: payload.sourceUrl,
    client: payload.client,
  };
  if (payload.extracted) {
    body.extracted = true;
    body.name = payload.extracted.name;
    body.metadata = payload.extracted.metadata;
  }

  let response: Response;
  try {
    response = await fetchFn(`${API_BASE}/api/cookify/text`, postInit(body, token));
  } catch {
    return { kind: "error", message: UNREACHABLE };
  }

  if (response.status === 429) return { kind: "rate_limited", retryAfter: retryAfter(response) };
  if (response.status === 401) return { kind: "unauthorized" };

  const json = await readJson(response);
  if (response.ok && typeof json?.cooklang === "string") return { kind: "ok", cooklang: json.cooklang };
  return { kind: "error", message: errorMessage(json) ?? unexpected(response) };
}

export async function requestCode(email: string, fetchFn: FetchFn = fetch): Promise<CodeResult> {
  const query = new URLSearchParams({ email, requester: "browser/extension" });
  let response: Response;
  try {
    response = await fetchFn(`${API_BASE}/api/sessions/new?${query}`, { signal: timeout() });
    // No account with this address: create one. Sign-up emails the code itself.
    if (response.status === 404) {
      response = await fetchFn(`${API_BASE}/api/sign_up`, postInit({ user: { email } }));
    }
  } catch {
    return { kind: "error", message: UNREACHABLE };
  }

  // 425: a code was sent moments ago and is still valid.
  if (response.ok || response.status === 425) return { kind: "sent" };
  if (response.status === 429) return { kind: "error", message: tooMany(response) };
  return { kind: "error", message: errorMessage(await readJson(response)) ?? unexpected(response) };
}

export async function verifyCode(email: string, code: string, fetchFn: FetchFn = fetch): Promise<VerifyResult> {
  let response: Response;
  try {
    response = await fetchFn(`${API_BASE}/api/sessions`, postInit({ session: { email, code: code.trim() } }));
  } catch {
    return { kind: "error", message: UNREACHABLE };
  }

  const json = await readJson(response);
  if (response.ok && typeof json?.token === "string") return { kind: "ok", token: json.token };
  if (response.status === 401) return { kind: "error", message: "That code didn't work. Check the email and try again." };
  if (response.status === 429) return { kind: "error", message: tooMany(response) };
  return { kind: "error", message: errorMessage(json) ?? unexpected(response) };
}

function postInit(body: unknown, token?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return { method: "POST", headers, body: JSON.stringify(body), signal: timeout() };
}

function timeout(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

function retryAfter(response: Response): number {
  const seconds = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
}

function tooMany(response: Response): string {
  return `Too many attempts. Try again in ${retryAfter(response)} seconds.`;
}

function unexpected(response: Response): string {
  return `cook.md answered with an error (${response.status}). Try again in a moment.`;
}

async function readJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** cook.md errors are `{errors: [{base: "msg"}]}`, `{errors: [{field: "msg"}]}` or `{errors: ["msg"]}`. */
function errorMessage(json: any): string | null {
  const first = Array.isArray(json?.errors) ? json.errors[0] : null;
  if (typeof first === "string") return first;
  if (first && typeof first === "object") {
    const [field, message] = Object.entries(first)[0] ?? [];
    if (typeof message !== "string") return null;
    if (field === "base") return message;
    return `${field!.charAt(0).toUpperCase()}${field!.slice(1)} ${message}`;
  }
  return null;
}
