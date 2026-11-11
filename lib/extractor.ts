import { extractRecipe, init, type Extraction } from "@cooklang/cooklang-import";
import wasmUrl from "@cooklang/cooklang-import/cooklang_import_bg.wasm?url";

let ready: Promise<unknown> | undefined;
let failure: string | undefined;

/** Why the extractors could not run, when they could not; shown under "no recipe data". */
export function extractionFailure(): string | undefined {
  return failure;
}

// The bytes are fetched and handed over whole rather than streamed: Safari serves
// extension files without the application/wasm type that streaming compilation needs.
async function load(): Promise<unknown> {
  try {
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error(`wasm fetch ${response.status}`);
    return await init({ module_or_path: await response.arrayBuffer() });
  } catch (error) {
    // Safari 18 refuses WebAssembly in extension pages whatever the policy says; its
    // build carries a plain-JavaScript translation of the same reader. The constant
    // keeps that (large) file out of the Chrome and Firefox builds.
    if (import.meta.env.BROWSER !== "safari") throw error;
    console.warn("WebAssembly unavailable, using the JavaScript recipe reader", error);
    const { startJsReader } = await import("./js-reader");
    return startJsReader();
  }
}

/**
 * Run the structured-data extractors on a page. Null when the page has no recipe,
 * and also when the wasm fails to load: the popup then offers "convert this page
 * anyway", which needs no local extraction.
 */
export async function extract(html: string, url: string): Promise<Extraction | null> {
  try {
    ready ??= load();
    await ready;
    return extractRecipe(html, url);
  } catch (error) {
    console.warn("Recipe extraction unavailable", error);
    failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return null;
  }
}
