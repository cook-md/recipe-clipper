import { extractRecipe, init, type Extraction } from "@cooklang/cooklang-import";
import wasmUrl from "@cooklang/cooklang-import/cooklang_import_bg.wasm?url";

let ready: Promise<unknown> | undefined;

/**
 * Run the structured-data extractors on a page. Null when the page has no recipe,
 * and also when the wasm fails to load: the popup then offers "convert this page
 * anyway", which needs no local extraction.
 */
export async function extract(html: string, url: string): Promise<Extraction | null> {
  try {
    ready ??= init({ module_or_path: wasmUrl });
    await ready;
    return extractRecipe(html, url);
  } catch (error) {
    console.warn("Recipe extraction unavailable", error);
    return null;
  }
}
