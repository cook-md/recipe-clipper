import { describe, expect, it } from "vitest";
import { snapshotFromInjection } from "../lib/injection";

const snapshot = { url: "https://example.com/r", title: "Soup", html: "<html></html>", selection: "", text: "Soup" };

describe("snapshotFromInjection", () => {
  it("reads an InjectionResult", () => {
    expect(snapshotFromInjection({ frameId: 0, result: snapshot })).toEqual(snapshot);
  });

  it("reads a bare return value", () => {
    expect(snapshotFromInjection(snapshot)).toEqual(snapshot);
  });

  it.each([undefined, null, {}, { frameId: 0 }, { result: null }, { result: "text" }, { result: { url: "https://example.com" } }, { frameId: 0, error: {} }])(
    "is null for %j",
    (injection) => {
      expect(snapshotFromInjection(injection)).toBeNull();
    },
  );
});
