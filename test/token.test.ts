import { describe, expect, it } from "vitest";
import { tokenExpired } from "../lib/token";

const NOW = 1_800_000_000_000; // ms
const b64url = (value: string) => Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const jwt = (payload: unknown) => `${b64url(JSON.stringify({ alg: "HS256" }))}.${b64url(JSON.stringify(payload))}.signature`;

describe("tokenExpired", () => {
  it("is false while exp is in the future", () => {
    expect(tokenExpired(jwt({ sub: 1, exp: NOW / 1000 + 60 }), NOW)).toBe(false);
  });

  it("is true once exp has passed", () => {
    expect(tokenExpired(jwt({ sub: 1, exp: NOW / 1000 - 1 }), NOW)).toBe(true);
    expect(tokenExpired(jwt({ sub: 1, exp: NOW / 1000 }), NOW)).toBe(true);
  });

  it("treats a token without a readable exp as not expired", () => {
    expect(tokenExpired(jwt({ sub: 1 }), NOW)).toBe(false);
    expect(tokenExpired(jwt({ sub: 1, exp: "soon" }), NOW)).toBe(false);
    expect(tokenExpired(jwt({ sub: 1, exp: null }), NOW)).toBe(false);
  });

  it("treats a malformed token as expired", () => {
    expect(tokenExpired("", NOW)).toBe(true);
    expect(tokenExpired("garbage", NOW)).toBe(true);
    expect(tokenExpired("a.b", NOW)).toBe(true);
    expect(tokenExpired("a.!!!.c", NOW)).toBe(true);
    expect(tokenExpired(`a.${b64url("not json")}.c`, NOW)).toBe(true);
    expect(tokenExpired(`a.${b64url('"a string"')}.c`, NOW)).toBe(true);
    expect(tokenExpired(`a.${b64url("null")}.c`, NOW)).toBe(true);
  });

  it("decodes base64url characters and missing padding", () => {
    // These payloads encode to base64 containing "-" and "_" (standard "+" and "/") and need padding.
    const dash = jwt({ n: "~~~>", exp: NOW / 1000 + 60 });
    const underscore = jwt({ n: "???", exp: NOW / 1000 - 60 });
    expect(dash.split(".")[1]).toContain("-");
    expect(underscore.split(".")[1]).toContain("_");
    expect(tokenExpired(dash, NOW)).toBe(false);
    expect(tokenExpired(underscore, NOW)).toBe(true);

    // Every padding length: 0, 1 and 2 missing "=".
    for (const pad of ["", "x", "xx"]) {
      expect(tokenExpired(jwt({ pad, exp: NOW / 1000 + 60 }), NOW)).toBe(false);
      expect(tokenExpired(jwt({ pad, exp: NOW / 1000 - 60 }), NOW)).toBe(true);
    }
  });

  it("reads non-ASCII payloads", () => {
    expect(tokenExpired(jwt({ name: "Борщ", exp: NOW / 1000 - 60 }), NOW)).toBe(true);
  });
});
