import type { Extraction } from "@cooklang/cooklang-import";
import { cookFilename } from "./filename";
import type { ClipRequest } from "./messages";
import type { PageSnapshot } from "./page-reader";

/**
 * What to send for this page: the locally extracted recipe when there is one,
 * otherwise the selection or the page text. Null when there is nothing to send.
 */
export function clipRequestFor(tabId: number, snapshot: PageSnapshot, extraction: Extraction | null): ClipRequest | null {
  if (extraction) {
    return {
      tabId,
      pageUrl: snapshot.url,
      filename: cookFilename(extraction.recipe.name),
      text: extraction.components.text,
      extracted: { name: extraction.components.name, metadata: extraction.components.metadata },
    };
  }

  const text = snapshot.selection.trim() ? snapshot.selection : snapshot.text;
  if (!text.trim()) return null;
  return { tabId, pageUrl: snapshot.url, filename: cookFilename(snapshot.title), text };
}
