import type { PageSnapshot } from "./page-reader";

/**
 * The snapshot out of one entry of what scripting.executeScript resolved to.
 * Browsers answer with InjectionResult objects (`{ frameId, result }`). Safari
 * lists that shape as supported from 17 only (MDN compatibility data), so a bare
 * return value, which is what an older Safari may hand back, is accepted too.
 * Null when the entry is neither.
 */
export function snapshotFromInjection(injection: unknown): PageSnapshot | null {
  if (isSnapshot(injection)) return injection;
  const result = (injection as { result?: unknown } | null | undefined)?.result;
  return isSnapshot(result) ? result : null;
}

function isSnapshot(value: unknown): value is PageSnapshot {
  if (value === null || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  return ["url", "title", "html", "selection", "text"].every((key) => typeof snapshot[key] === "string");
}
