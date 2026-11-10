/**
 * Save text as a file from the background context. Returns false where there is
 * no downloads API (Safari); the popup then saves through a link instead.
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
  if (!browser.downloads?.download) return false;

  const url =
    typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(new Blob([text], { type: COOK_MIME }))
      : `data:${COOK_MIME},${encodeURIComponent(text)}`;

  await browser.downloads.download({ url, filename, saveAs: false });
  return true;
}
