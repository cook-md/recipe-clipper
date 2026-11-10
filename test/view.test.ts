import { describe, expect, it } from "vitest";
import { viewFor, type ViewInput } from "../lib/view";

const snapshot = { url: "https://example.com/r", title: "Lemon Chicken | Example", html: "<html></html>", selection: "", text: "page text" };
const extraction = {
  recipe: { name: "Lemon Chicken", description: null, image: [], ingredients: ["8 chicken thighs"], instructions: "Roast.", metadata: {} },
  components: { name: "Lemon Chicken", metadata: "", text: "8 chicken thighs\n\nRoast." },
};
const base: ViewInput = { snapshot, extraction, job: null, pending: null, now: 1_000_000 };

describe("viewFor", () => {
  it("is loading until the page has been read", () => {
    expect(viewFor({ ...base, snapshot: undefined, extraction: undefined })).toEqual({ kind: "loading" });
    expect(viewFor({ ...base, extraction: undefined })).toEqual({ kind: "loading" });
  });

  it("says so when the page can't be read", () => {
    expect(viewFor({ ...base, snapshot: null, extraction: null })).toEqual({ kind: "unreadable" });
  });

  it("previews an extracted recipe", () => {
    expect(viewFor(base)).toEqual({ kind: "preview", recipe: extraction.recipe, filename: "lemon-chicken.cook" });
  });

  it("offers to convert anyway when there is no recipe", () => {
    expect(viewFor({ ...base, extraction: null })).toEqual({ kind: "no-recipe", hasSelection: false });
    expect(viewFor({ ...base, extraction: null, snapshot: { ...snapshot, selection: "2 eggs" } })).toEqual({
      kind: "no-recipe",
      hasSelection: true,
    });
  });

  it("shows a running conversion", () => {
    const job = { status: "converting" as const, pageUrl: snapshot.url, filename: "lemon-chicken.cook", startedAt: base.now - 5_000 };
    expect(viewFor({ ...base, job })).toEqual({ kind: "converting" });
  });

  it("turns a conversion that never came back into an error", () => {
    const job = { status: "converting" as const, pageUrl: snapshot.url, filename: "x.cook", startedAt: base.now - 91_000 };
    expect(viewFor({ ...base, job })).toEqual({ kind: "error", message: "That took too long. Try again." });
  });

  it("shows the result", () => {
    const job = { status: "done" as const, pageUrl: snapshot.url, filename: "lemon-chicken.cook", cooklang: "Roast.", downloaded: true };
    expect(viewFor({ ...base, job })).toEqual({ kind: "done", cooklang: "Roast.", filename: "lemon-chicken.cook", downloaded: true });
  });

  it("counts down a rate limit, then falls back to the preview", () => {
    const job = { status: "rate_limited" as const, pageUrl: snapshot.url, retryAt: base.now + 41_200, signedIn: false };
    expect(viewFor({ ...base, job })).toEqual({ kind: "rate-limited", seconds: 42, signedIn: false });
    expect(viewFor({ ...base, job, now: job.retryAt + 1 }).kind).toBe("preview");
  });

  it("shows an error", () => {
    const job = { status: "error" as const, pageUrl: snapshot.url, message: "No recipe found in the text" };
    expect(viewFor({ ...base, job })).toEqual({ kind: "error", message: "No recipe found in the text" });
  });

  it("ignores a job left over from another page in the same tab", () => {
    const job = { status: "done" as const, pageUrl: "https://example.com/other", filename: "o.cook", cooklang: "x", downloaded: true };
    expect(viewFor({ ...base, job }).kind).toBe("preview");
  });

  it("puts a pending sign-in ahead of everything else", () => {
    expect(viewFor({ ...base, pending: { step: "email" } })).toEqual({ kind: "sign-in-email" });
    expect(viewFor({ ...base, pending: { step: "code", email: "a@example.com" } })).toEqual({
      kind: "sign-in-code",
      email: "a@example.com",
    });
  });
});
