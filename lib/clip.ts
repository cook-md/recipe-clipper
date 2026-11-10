import type { Client, ConvertPayload, ConvertResult } from "./api";
import type { Session } from "./auth";
import type { Job } from "./jobs";
import type { ClipRequest } from "./messages";
import { tokenExpired } from "./token";
import { withoutFragment } from "./url";

/** Signed in, the limit is about one request a second: a wait this short is worth sitting out once. */
const SIGNED_IN_MAX_RETRY_SECONDS = 2;

/** Everything runClip touches outside itself, so it can be tested without a browser. */
export interface ClipDeps {
  convert(payload: ConvertPayload, token?: string): Promise<ConvertResult>;
  getSession(): Promise<Session | null>;
  clearSession(): Promise<void>;
  setJob(tabId: number, job: Job): Promise<void>;
  saveCook(text: string, filename: string): Promise<boolean>;
  sleep(ms: number): Promise<void>;
  now(): number;
  client: Client;
}

/**
 * Tabs with a clip running in this worker. In memory on purpose: when the browser
 * stops the worker the set is gone, and so is the request it was tracking.
 */
const inFlight = new Set<number>();

export function clipInFlight(tabId: number): boolean {
  return inFlight.has(tabId);
}

/**
 * Convert the page and save the file, recording progress as the tab's job.
 * Resolves to false, having done nothing, when the tab already has a clip running.
 */
export async function runClip(request: ClipRequest, deps: ClipDeps): Promise<boolean> {
  const { tabId, pageUrl, filename } = request;
  if (inFlight.has(tabId)) return false;
  inFlight.add(tabId);

  try {
    await deps.setJob(tabId, { status: "converting", pageUrl, filename, startedAt: deps.now() });
    await deps.setJob(tabId, await convertAndSave(request, deps));
  } catch {
    await deps.setJob(tabId, { status: "error", pageUrl, message: "Something went wrong. Try again." });
  } finally {
    inFlight.delete(tabId);
  }
  return true;
}

async function convertAndSave(request: ClipRequest, deps: ClipDeps): Promise<Job> {
  const { pageUrl, filename } = request;
  const payload: ConvertPayload = {
    text: request.text,
    // The job keeps the exact page URL (the popup matches on it); the server gets it without the #fragment.
    sourceUrl: withoutFragment(pageUrl),
    client: deps.client,
    extracted: request.extracted,
  };

  // The token in use; undefined once the request is anonymous.
  let token = (await deps.getSession())?.token;
  if (token !== undefined && tokenExpired(token, deps.now())) {
    await deps.clearSession();
    token = undefined;
  }

  let result = await deps.convert(payload, token);

  if (result.kind === "unauthorized" && token !== undefined) {
    // The server refused the token: sign out and clip anonymously.
    await deps.clearSession();
    token = undefined;
    result = await deps.convert(payload);
  }

  // A 429 is only ever a rate limit (ours, a per-IP throttle, a proxy): it says
  // nothing about the token, so it never signs anyone out.
  if (result.kind === "rate_limited" && token !== undefined && result.retryAfter <= SIGNED_IN_MAX_RETRY_SECONDS) {
    await deps.sleep(result.retryAfter * 1000);
    result = await deps.convert(payload, token);
    if (result.kind === "unauthorized") {
      await deps.clearSession();
      token = undefined;
    }
  }

  switch (result.kind) {
    case "ok": {
      const downloaded = await deps.saveCook(result.cooklang, filename).catch(() => false);
      return { status: "done", pageUrl, filename, cooklang: result.cooklang, downloaded };
    }
    case "rate_limited":
      // signedIn: whether a valid session was used for the request that hit the limit.
      return { status: "rate_limited", pageUrl, retryAt: deps.now() + result.retryAfter * 1000, signedIn: token !== undefined };
    case "unauthorized":
      return { status: "error", pageUrl, message: "cook.md didn't accept the request. Try again." };
    case "error":
      return { status: "error", pageUrl, message: result.message };
  }
}
