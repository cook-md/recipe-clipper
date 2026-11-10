import { saveWith, type SaveTargets } from "./save";

/**
 * Save text as a file from the background context: through the downloads API
 * where there is one, in Safari through a native message to the containing app
 * (see safari/). Returns false when neither saved it; the popup then saves through
 * a link instead.
 *
 * Chrome's service worker has no URL.createObjectURL, so it gets a data: URL.
 * Firefox refuses data: URLs in downloads.download but its background page has
 * createObjectURL, so it gets a blob: URL.
 *
 * The type is application/octet-stream on purpose: given text/plain, Chrome
 * replaces the unknown .cook extension with .txt. The bytes are UTF-8 either way
 * (encodeURIComponent percent-encodes UTF-8; a Blob encodes strings as UTF-8).
 */
export const COOK_MIME = "application/octet-stream";

export async function saveCook(text: string, filename: string): Promise<boolean> {
  return saveWith(text, filename, targets());
}

function targets(): SaveTargets {
  if (typeof browser.downloads?.download === "function") return { download };
  // Safari only: elsewhere the manifest has no nativeMessaging permission and
  // there is no app to answer. Safari ignores the application id.
  if (import.meta.env.BROWSER === "safari" && typeof browser.runtime.sendNativeMessage === "function") {
    return { sendNative: (message) => browser.runtime.sendNativeMessage("org.cooklang.RecipeClipper", message) };
  }
  return {};
}

async function download(text: string, filename: string): Promise<void> {
  const url =
    typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(new Blob([text], { type: COOK_MIME }))
      : `data:${COOK_MIME},${encodeURIComponent(text)}`;

  await browser.downloads.download({ url, filename, saveAs: false });
}
