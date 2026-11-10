import { describe, expect, it, vi } from "vitest";
import type { ConvertPayload, ConvertResult } from "../lib/api";
import type { Session } from "../lib/auth";
import { clipInFlight, runClip, type ClipDeps } from "../lib/clip";
import type { Job } from "../lib/jobs";

const NOW = 1_000_000;
const request = { tabId: 7, pageUrl: "https://example.com/r", filename: "lemon-chicken.cook", text: "8 chicken thighs\n\nRoast." };
const ok: ConvertResult = { kind: "ok", cooklang: "Roast the @chicken{8}." };

/** Fake dependencies. `results` are handed out one per convert call; the last one repeats. */
function fakes(results: ConvertResult[] = [ok], session: Session | null = null) {
  const jobs: Job[] = [];
  const state = { session };
  let call = 0;
  const deps = {
    convert: vi.fn(async (_payload: ConvertPayload, _token?: string) => results[Math.min(call++, results.length - 1)]!),
    getSession: vi.fn(async () => state.session),
    clearSession: vi.fn(async () => {
      state.session = null;
    }),
    setJob: vi.fn(async (_tabId: number, job: Job) => {
      jobs.push(job);
    }),
    saveCook: vi.fn(async (_text: string, _filename: string) => true),
    sleep: vi.fn(async (_ms: number) => {}),
    now: () => NOW,
    client: "extension_chrome" as const,
  } satisfies ClipDeps;
  return { deps, jobs, state };
}

const b64url = (value: string) => Buffer.from(value, "utf8").toString("base64url");
const jwt = (exp: number) => `${b64url("{}")}.${b64url(JSON.stringify({ exp }))}.sig`;
const VALID = jwt(NOW / 1000 + 3600);
const EXPIRED = jwt(NOW / 1000 - 3600);

const tokens = (deps: { convert: { mock: { calls: unknown[][] } } }) => deps.convert.mock.calls.map((call) => call[1]);

describe("runClip", () => {
  it("converts, saves the file and records the result", async () => {
    const { deps, jobs } = fakes();

    await runClip({ ...request, extracted: { name: "Lemon Chicken", metadata: "servings: 4\n" } }, deps);

    expect(deps.convert).toHaveBeenCalledTimes(1);
    expect(deps.convert.mock.calls[0]).toEqual([
      { text: request.text, sourceUrl: request.pageUrl, client: "extension_chrome", extracted: { name: "Lemon Chicken", metadata: "servings: 4\n" } },
      undefined,
    ]);
    expect(deps.saveCook).toHaveBeenCalledWith("Roast the @chicken{8}.", "lemon-chicken.cook");
    expect(deps.setJob).toHaveBeenCalledWith(7, expect.anything());
    expect(jobs).toEqual([
      { status: "converting", pageUrl: request.pageUrl, filename: request.filename, startedAt: NOW },
      { status: "done", pageUrl: request.pageUrl, filename: request.filename, cooklang: "Roast the @chicken{8}.", downloaded: true },
    ]);
  });

  it("sends the source URL without its #fragment but keeps the job on the exact page URL", async () => {
    const { deps, jobs } = fakes();
    const pageUrl = "https://example.com/r?id=7#step-3";

    await runClip({ ...request, pageUrl }, deps);

    expect(deps.convert.mock.calls[0]![0].sourceUrl).toBe("https://example.com/r?id=7");
    expect(jobs.map((job) => job.pageUrl)).toEqual([pageUrl, pageUrl]);
  });

  it("sends the session token when signed in", async () => {
    const { deps } = fakes([ok], { token: VALID, email: "a@example.com" });
    await runClip(request, deps);
    expect(tokens(deps)).toEqual([VALID]);
  });

  it("still records the result when the download fails", async () => {
    const { deps, jobs } = fakes();
    deps.saveCook.mockRejectedValueOnce(new Error("Invalid filename"));

    await runClip(request, deps);

    expect(jobs.at(-1)).toEqual({ status: "done", pageUrl: request.pageUrl, filename: request.filename, cooklang: "Roast the @chicken{8}.", downloaded: false });
  });

  it("records downloaded: false where there is no downloads API", async () => {
    const { deps, jobs } = fakes();
    deps.saveCook.mockResolvedValueOnce(false);
    await runClip(request, deps);
    expect(jobs.at(-1)).toMatchObject({ status: "done", downloaded: false });
  });

  it("records an anonymous rate limit and leaves the session alone", async () => {
    const { deps, jobs } = fakes([{ kind: "rate_limited", retryAfter: 42 }]);

    await runClip(request, deps);

    expect(deps.convert).toHaveBeenCalledTimes(1);
    expect(jobs.at(-1)).toEqual({ status: "rate_limited", pageUrl: request.pageUrl, retryAt: NOW + 42_000, signedIn: false });
    expect(deps.clearSession).not.toHaveBeenCalled();
    expect(deps.saveCook).not.toHaveBeenCalled();
  });

  it("waits out a short signed-in rate limit and retries once", async () => {
    const { deps, jobs } = fakes([{ kind: "rate_limited", retryAfter: 1 }, ok], { token: VALID, email: "a@example.com" });

    await runClip(request, deps);

    expect(deps.sleep).toHaveBeenCalledTimes(1);
    expect(deps.sleep).toHaveBeenCalledWith(1000);
    expect(tokens(deps)).toEqual([VALID, VALID]);
    expect(jobs.at(-1)).toMatchObject({ status: "done", downloaded: true });
    expect(deps.clearSession).not.toHaveBeenCalled();
  });

  it("retries a short signed-in rate limit only once", async () => {
    const { deps, jobs } = fakes([{ kind: "rate_limited", retryAfter: 1 }], { token: VALID, email: "a@example.com" });

    await runClip(request, deps);

    expect(deps.convert).toHaveBeenCalledTimes(2);
    expect(jobs.at(-1)).toEqual({ status: "rate_limited", pageUrl: request.pageUrl, retryAt: NOW + 1000, signedIn: true });
  });

  it("never signs out over a long signed-in rate limit", async () => {
    const { deps, jobs, state } = fakes([{ kind: "rate_limited", retryAfter: 120 }], { token: VALID, email: "a@example.com" });

    await runClip(request, deps);

    expect(deps.convert).toHaveBeenCalledTimes(1);
    expect(deps.sleep).not.toHaveBeenCalled();
    expect(jobs.at(-1)).toEqual({ status: "rate_limited", pageUrl: request.pageUrl, retryAt: NOW + 120_000, signedIn: true });
    expect(deps.clearSession).not.toHaveBeenCalled();
    expect(state.session).not.toBeNull();
  });

  it("drops an expired token and clips anonymously", async () => {
    const { deps, jobs, state } = fakes([ok], { token: EXPIRED, email: "a@example.com" });

    await runClip(request, deps);

    expect(deps.clearSession).toHaveBeenCalledTimes(1);
    expect(state.session).toBeNull();
    expect(tokens(deps)).toEqual([undefined]);
    expect(jobs.at(-1)).toMatchObject({ status: "done" });
  });

  it("records an expired token's rate limit as signed out, without a retry", async () => {
    const { deps, jobs } = fakes([{ kind: "rate_limited", retryAfter: 1 }], { token: EXPIRED, email: "a@example.com" });

    await runClip(request, deps);

    expect(deps.convert).toHaveBeenCalledTimes(1);
    expect(jobs.at(-1)).toEqual({ status: "rate_limited", pageUrl: request.pageUrl, retryAt: NOW + 1000, signedIn: false });
  });

  it("on 401 signs out and retries once without the token", async () => {
    const { deps, jobs, state } = fakes([{ kind: "unauthorized" }, ok], { token: VALID, email: "a@example.com" });

    await runClip(request, deps);

    expect(deps.clearSession).toHaveBeenCalledTimes(1);
    expect(state.session).toBeNull();
    expect(tokens(deps)).toEqual([VALID, undefined]);
    expect(jobs.at(-1)).toMatchObject({ status: "done", downloaded: true });
  });

  it("records the anonymous retry's rate limit as signed out", async () => {
    const { deps, jobs } = fakes([{ kind: "unauthorized" }, { kind: "rate_limited", retryAfter: 1 }], { token: VALID, email: "a@example.com" });

    await runClip(request, deps);

    expect(deps.convert).toHaveBeenCalledTimes(2);
    expect(deps.sleep).not.toHaveBeenCalled();
    expect(jobs.at(-1)).toEqual({ status: "rate_limited", pageUrl: request.pageUrl, retryAt: NOW + 1000, signedIn: false });
  });

  it("gives up with an error when even the anonymous request is refused with 401", async () => {
    const { deps, jobs } = fakes([{ kind: "unauthorized" }]);

    await runClip(request, deps);

    expect(deps.convert).toHaveBeenCalledTimes(1);
    expect(deps.clearSession).not.toHaveBeenCalled();
    expect(jobs.at(-1)).toEqual({ status: "error", pageUrl: request.pageUrl, message: "cook.md didn't accept the request. Try again." });
  });

  it("records the server's error", async () => {
    const { deps, jobs } = fakes([{ kind: "error", message: "No recipe found in the text" }]);
    await runClip(request, deps);
    expect(jobs.at(-1)).toEqual({ status: "error", pageUrl: request.pageUrl, message: "No recipe found in the text" });
  });

  it("records an error when something throws", async () => {
    const { deps, jobs } = fakes();
    deps.convert.mockRejectedValueOnce(new Error("boom"));

    await runClip(request, deps);

    expect(jobs.at(-1)).toEqual({ status: "error", pageUrl: request.pageUrl, message: "Something went wrong. Try again." });
    expect(clipInFlight(request.tabId)).toBe(false);
  });

  it("ignores a second clip for a tab that already has one in flight", async () => {
    const { deps, jobs } = fakes();
    let finish!: (result: ConvertResult) => void;
    deps.convert.mockImplementationOnce(() => new Promise<ConvertResult>((resolve) => (finish = resolve)));

    const first = runClip(request, deps);
    expect(clipInFlight(request.tabId)).toBe(true);
    const second = await runClip({ ...request, filename: "second.cook" }, deps);
    const otherTab = await runClip({ ...request, tabId: 8, filename: "other.cook" }, deps);

    expect(second).toBe(false);
    expect(otherTab).toBe(true);
    finish(ok);
    expect(await first).toBe(true);

    expect(deps.convert).toHaveBeenCalledTimes(2); // tab 7 once, tab 8 once
    expect(jobs.map((job) => "filename" in job && job.filename)).not.toContain("second.cook");
    expect(clipInFlight(request.tabId)).toBe(false);

    // The tab is free again afterwards.
    expect(await runClip(request, deps)).toBe(true);
  });
});
