import { describe, expect, it } from "vitest";
import { cookFilename } from "../lib/filename";

describe("cookFilename", () => {
  it("turns a title into a kebab-case .cook name", () => {
    expect(cookFilename("Lemon Chicken Traybake")).toBe("lemon-chicken-traybake.cook");
  });

  it("strips accents and punctuation", () => {
    expect(cookFilename("Crème brûlée: the “easy” way!")).toBe("creme-brulee-the-easy-way.cook");
  });

  it("keeps letters from other scripts", () => {
    expect(cookFilename("Борщ с пампушками")).toBe("борщ-с-пампушками.cook");
  });

  it("caps the length without a trailing dash", () => {
    const name = cookFilename(`${"very ".repeat(40)}long title`);
    expect(name.length).toBeLessThanOrEqual(85);
    expect(name).toMatch(/^[a-z-]+[a-z]\.cook$/);
  });

  it("falls back when nothing usable is left", () => {
    expect(cookFilename("")).toBe("recipe.cook");
    expect(cookFilename("!!! ???")).toBe("recipe.cook");
  });
});
