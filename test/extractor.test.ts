import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeAll, describe, expect, it } from "vitest";
import { extractRecipe, initSync } from "@cooklang/cooklang-import";

const require = createRequire(import.meta.url);
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

beforeAll(() => {
  initSync({ module: readFileSync(require.resolve("@cooklang/cooklang-import/cooklang_import_bg.wasm")) });
});

describe("the extractor package on the page shapes we expect", () => {
  it("reads a plain JSON-LD recipe", () => {
    const result = extractRecipe(fixture("json-ld.html"), "https://example.com/lemon-chicken")!;
    expect(result.recipe.name).toBe("Lemon Chicken Traybake");
    expect(result.recipe.ingredients).toHaveLength(3);
    expect(result.recipe.image[0]).toBe("https://example.com/img/lemon-chicken.jpg");
    expect(result.recipe.instructions).toContain("Roast for 40 minutes.");
    expect(result.components.name).toBe("Lemon Chicken Traybake");
    expect(result.components.text).toContain("8 chicken thighs\n");
    expect(result.components.metadata).toContain("servings: 4");
  });

  it("finds the Recipe inside an @graph with HowToSection steps", () => {
    const result = extractRecipe(fixture("graph.html"), "https://example.com/dal")!;
    expect(result.recipe.name).toBe("Weeknight Dal");
    expect(result.recipe.ingredients).toHaveLength(3);
    expect(result.recipe.instructions).toContain("Simmer with the onion");
  });

  it("falls back to MicroData", () => {
    const result = extractRecipe(fixture("microdata.html"), "https://example.com/flatbread")!;
    expect(result.recipe.name).toBe("Flatbread");
    expect(result.recipe.ingredients).toEqual(["250 g flour", "150 ml water"]);
    expect(result.recipe.instructions).toContain("Rest for 30 minutes.");
  });

  it("returns null for a page with no recipe", () => {
    expect(extractRecipe(fixture("no-recipe.html"), "https://example.com/hours")).toBeNull();
  });
});
