/**
 * Where a converted recipe can be written from the background context, in order
 * of preference. Each is absent in a browser that lacks it. No `browser` global
 * here: lib/download.ts supplies the real ones, the tests supply fakes.
 */
export interface SaveTargets {
  /** The downloads API (Chrome, Firefox). */
  download?: (text: string, filename: string) => Promise<void>;
  /**
   * A native message to the containing app (Safari, which has no downloads API):
   * the app's extension handler writes the file into the Downloads folder.
   */
  sendNative?: (message: NativeSaveMessage) => Promise<unknown>;
}

/** Extension → containing app. Answered with `{ ok: true, filename }` or `{ ok: false, error }`. */
export interface NativeSaveMessage {
  type: "save-cook";
  filename: string;
  text: string;
}

/** A native handler that hasn't answered by now is treated as failed. */
export const NATIVE_TIMEOUT_MS = 10_000;

/**
 * Save through the first target there is. Resolves to false when the file was not
 * saved (no target, the app refused or failed, no answer in time); the popup then
 * offers to save through a link. Rejects only when the downloads API does.
 */
export async function saveWith(text: string, filename: string, targets: SaveTargets, timeoutMs = NATIVE_TIMEOUT_MS): Promise<boolean> {
  if (targets.download) {
    await targets.download(text, filename);
    return true;
  }
  if (targets.sendNative) {
    try {
      const reply = await withTimeout(targets.sendNative({ type: "save-cook", filename, text }), timeoutMs);
      return (reply as { ok?: unknown } | null | undefined)?.ok === true;
    } catch {
      return false;
    }
  }
  return false;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
