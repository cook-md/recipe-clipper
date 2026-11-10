import { describe, expect, it, vi } from "vitest";
import { clientFor, convert, requestCode, verifyCode } from "../lib/api";

function respond(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return vi.fn(async (_url: string, _init?: any) => new Response(JSON.stringify(body), { status, headers }));
}

const payload = { text: "8 chicken thighs\n\nRoast.", sourceUrl: "https://example.com/r", client: "extension_chrome" as const };

describe("clientFor", () => {
  it("maps WXT browser names to the server's client values", () => {
    expect(clientFor("chrome")).toBe("extension_chrome");
    expect(clientFor("edge")).toBe("extension_chrome");
    expect(clientFor("firefox")).toBe("extension_firefox");
    expect(clientFor("safari")).toBe("extension_safari");
  });
});

describe("convert", () => {
  it("posts the page text and returns the Cooklang", async () => {
    const fetchFn = respond(200, { cooklang: "Roast the @chicken{8}." });

    const result = await convert(payload, undefined, fetchFn);

    expect(result).toEqual({ kind: "ok", cooklang: "Roast the @chicken{8}." });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://cook.md/api/cookify/text");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({
      text: payload.text,
      source_url: "https://example.com/r",
      client: "extension_chrome",
    });
  });

  it("sends extracted components and the bearer token when given", async () => {
    const fetchFn = respond(200, { cooklang: "x" });

    await convert({ ...payload, extracted: { name: "Lemon Chicken", metadata: "servings: 4\n" } }, "tok", fetchFn);

    const [, init] = fetchFn.mock.calls[0]!;
    expect(init.headers).toEqual({ "content-type": "application/json", authorization: "Bearer tok" });
    expect(JSON.parse(init.body)).toMatchObject({ extracted: true, name: "Lemon Chicken", metadata: "servings: 4\n" });
  });

  it("maps 429 to rate_limited with the Retry-After seconds", async () => {
    const result = await convert(payload, undefined, respond(429, {}, { "retry-after": "42" }));
    expect(result).toEqual({ kind: "rate_limited", retryAfter: 42 });
  });

  it("defaults Retry-After to 60 when the header is missing", async () => {
    expect(await convert(payload, undefined, respond(429))).toEqual({ kind: "rate_limited", retryAfter: 60 });
  });

  it("surfaces the server's message on 422", async () => {
    const result = await convert(payload, undefined, respond(422, { errors: [{ base: "No recipe found in the text" }] }));
    expect(result).toEqual({ kind: "error", message: "No recipe found in the text" });
  });

  it("reports an unreachable server", async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: any): Promise<Response> => {
      throw new TypeError("Failed to fetch");
    });
    expect(await convert(payload, undefined, fetchFn)).toEqual({ kind: "error", message: "Couldn't reach cook.md. Check your connection and try again." });
  });

  it("maps 401 to unauthorized: the token was not accepted", async () => {
    expect(await convert(payload, "stale", respond(401, { errors: ["Not authorized"] }))).toEqual({ kind: "unauthorized" });
  });

  it("reports an unexpected status", async () => {
    expect(await convert(payload, undefined, respond(500))).toEqual({ kind: "error", message: "cook.md answered with an error (500). Try again in a moment." });
  });
});

describe("requestCode", () => {
  it("asks for a code for an existing account", async () => {
    const fetchFn = respond(200, { code: { retry_in_seconds: 60 } });

    expect(await requestCode("a+b@example.com", fetchFn)).toEqual({ kind: "sent" });
    expect(fetchFn.mock.calls[0]![0]).toBe(
      "https://cook.md/api/sessions/new?email=a%2Bb%40example.com&requester=browser%2Fextension",
    );
  });

  it("treats 425 as sent: the earlier code is still valid", async () => {
    expect(await requestCode("a@example.com", respond(425))).toEqual({ kind: "sent" });
  });

  it("signs a new address up when there is no account", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));

    expect(await requestCode("new@example.com", fetchFn)).toEqual({ kind: "sent" });
    const [url, init] = fetchFn.mock.calls[1]!;
    expect(url).toBe("https://cook.md/api/sign_up");
    expect(JSON.parse(init.body)).toEqual({ user: { email: "new@example.com" } });
  });

  it("returns the validation message when sign-up is refused", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ email: "is invalid" }] }), { status: 422 }));

    expect(await requestCode("nope", fetchFn)).toEqual({ kind: "error", message: "Email is invalid" });
  });

  it("reports rate limiting", async () => {
    expect(await requestCode("a@example.com", respond(429, {}, { "retry-after": "20" }))).toEqual({
      kind: "error",
      message: "Too many attempts. Try again in 20 seconds.",
    });
  });
});

describe("verifyCode", () => {
  it("returns the token", async () => {
    const fetchFn = respond(201, { token: "jwt", status: "none" });

    expect(await verifyCode("a@example.com", " 123456 ", fetchFn)).toEqual({ kind: "ok", token: "jwt" });
    expect(JSON.parse(fetchFn.mock.calls[0]![1].body)).toEqual({ session: { email: "a@example.com", code: "123456" } });
  });

  it("explains a wrong code", async () => {
    expect(await verifyCode("a@example.com", "000000", respond(401))).toEqual({
      kind: "error",
      message: "That code didn't work. Check the email and try again.",
    });
  });
});
