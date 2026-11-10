import type { Extraction, Recipe } from "@cooklang/cooklang-import";
import type { PendingCode, PendingSignIn } from "./auth";
import { cookFilename } from "./filename";
import type { Job } from "./jobs";
import type { PageSnapshot } from "./page-reader";

/** A conversion with no answer after this long is shown as failed (the worker was stopped). */
const STUCK_AFTER_MS = 90_000;

/** A stored code step is dropped after this long: the emailed code is no use by then. */
export const CODE_STEP_TTL_MS = 10 * 60_000;

/** Also true for a stored step without a timestamp, which an older version wrote. */
export function pendingCodeExpired(pending: PendingCode, now: number): boolean {
  return typeof pending.requestedAt !== "number" || now - pending.requestedAt > CODE_STEP_TTL_MS;
}

export type View =
  | { kind: "loading" }
  | { kind: "unreadable" }
  | { kind: "preview"; recipe: Recipe; filename: string }
  | { kind: "no-recipe"; hasSelection: boolean }
  | { kind: "converting" }
  | { kind: "done"; cooklang: string; filename: string; downloaded: boolean }
  | { kind: "rate-limited"; seconds: number; signedIn: boolean }
  | { kind: "error"; message: string }
  | { kind: "sign-in-email" }
  | { kind: "sign-in-code"; email: string };

export interface ViewInput {
  /** undefined: not read yet; null: the page can't be read. */
  snapshot: PageSnapshot | null | undefined;
  /** undefined: not run yet; null: no recipe on the page. */
  extraction: Extraction | null | undefined;
  job: Job | null;
  pending: PendingSignIn | null;
  now: number;
}

export function viewFor({ snapshot, extraction, job, pending, now }: ViewInput): View {
  if (pending?.step === "email") return { kind: "sign-in-email" };
  if (pending?.step === "code" && !pendingCodeExpired(pending, now)) return { kind: "sign-in-code", email: pending.email };

  if (snapshot === null) return { kind: "unreadable" };
  if (snapshot === undefined || extraction === undefined) return { kind: "loading" };

  if (job && job.pageUrl === snapshot.url) {
    switch (job.status) {
      case "converting":
        if (now - job.startedAt > STUCK_AFTER_MS) return { kind: "error", message: "That took too long. Try again." };
        return { kind: "converting" };
      case "done":
        return { kind: "done", cooklang: job.cooklang, filename: job.filename, downloaded: job.downloaded };
      case "error":
        return { kind: "error", message: job.message };
      case "rate_limited":
        if (job.retryAt > now) {
          return { kind: "rate-limited", seconds: Math.ceil((job.retryAt - now) / 1000), signedIn: job.signedIn };
        }
        break; // the wait is over: back to the page view
    }
  }

  if (extraction) {
    return { kind: "preview", recipe: extraction.recipe, filename: cookFilename(extraction.recipe.name) };
  }
  return { kind: "no-recipe", hasSelection: snapshot.selection.length > 0 };
}
