import { describe, expect, it } from "vitest";
import { withoutFragment } from "../lib/url";

describe("withoutFragment", () => {
  it("drops the #fragment", () => {
    expect(withoutFragment("https://example.com/r#step-3")).toBe("https://example.com/r");
    expect(withoutFragment("https://example.com/r#")).toBe("https://example.com/r");
  });

  it("keeps the query string", () => {
    expect(withoutFragment("https://example.com/r?id=7&print=1#comments")).toBe("https://example.com/r?id=7&print=1");
  });

  it("cuts at the first # only", () => {
    expect(withoutFragment("https://example.com/r#a#b?x=1")).toBe("https://example.com/r");
  });

  it("leaves a URL without a fragment exactly as it is", () => {
    expect(withoutFragment("https://example.com")).toBe("https://example.com");
    expect(withoutFragment("https://example.com/r?q=a%23b")).toBe("https://example.com/r?q=a%23b");
    expect(withoutFragment("")).toBe("");
  });
});
