import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { extractRecipe } from "@cooklang/cooklang-import";
import { startJsReader } from "../lib/js-reader";

// Its own file, so the reader has not been started yet when the global is removed.
it("starts the plain-JavaScript reader where there is no WebAssembly global at all", async () => {
  const scope = globalThis as unknown as { WebAssembly?: unknown };
  const real = scope.WebAssembly;
  delete scope.WebAssembly;
  try {
    await startJsReader();
    expect(scope.WebAssembly).toBeUndefined();
    const html = readFileSync(new URL("./fixtures/json-ld.html", import.meta.url), "utf8");
    expect(extractRecipe(html, "https://example.com/lemon-chicken")!.recipe.name).toBe("Lemon Chicken Traybake");
  } finally {
    scope.WebAssembly = real;
  }
});
