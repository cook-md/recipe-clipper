import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import { extractRecipe } from "@cooklang/cooklang-import";
import { startJsReader } from "../lib/js-reader";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

// The reader Safari 18 falls back to: the same code as the wasm, translated to
// JavaScript by `npm run reader:js` (run on install).
describe("the plain-JavaScript recipe reader", () => {
  beforeAll(async () => {
    const real = { Module: WebAssembly.Module, Instance: WebAssembly.Instance };
    await startJsReader();
    expect(WebAssembly.Module).toBe(real.Module);
    expect(WebAssembly.Instance).toBe(real.Instance);
  });

  it("was translated from the wasm that is installed", () => {
    const wasm = createRequire(import.meta.url).resolve("@cooklang/cooklang-import/cooklang_import_bg.wasm");
    const hash = createHash("sha256").update(readFileSync(wasm)).digest("hex");
    const firstLine = readFileSync(new URL("../lib/generated/reader-asm.js", import.meta.url), "utf8").split("\n", 1)[0];
    expect(firstLine).toBe(`// wasm sha256: ${hash}`);
  });

  it("reads a JSON-LD recipe", () => {
    const result = extractRecipe(fixture("json-ld.html"), "https://example.com/lemon-chicken")!;
    expect(result.recipe.name).toBe("Lemon Chicken Traybake");
    expect(result.recipe.ingredients).toHaveLength(3);
    expect(result.components.text).toContain("8 chicken thighs\n");
    expect(result.components.metadata).toContain("servings: 4");
  });

  it("falls back to MicroData and returns null without a recipe", () => {
    expect(extractRecipe(fixture("microdata.html"), "https://example.com/flatbread")!.recipe.ingredients).toEqual(["250 g flour", "150 ml water"]);
    expect(extractRecipe(fixture("no-recipe.html"), "https://example.com/hours")).toBeNull();
  });

  it("still reads correctly after its memory has grown", () => {
    const small = extractRecipe(fixture("json-ld.html"), "https://example.com/lemon-chicken")!;
    // ~5 MB of non-ASCII page text forces several memory growths.
    const big = fixture("json-ld.html").replace("</body>", `<p>${"lorem ipsum é ".repeat(400_000)}</p></body>`);
    const grown = extractRecipe(big, "https://example.com/lemon-chicken")!;
    expect(grown.recipe).toEqual(small.recipe);
    expect(extractRecipe(fixture("json-ld.html"), "https://example.com/lemon-chicken")!.recipe).toEqual(small.recipe);
  });
});
