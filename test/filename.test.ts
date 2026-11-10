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

  it("prefixes names Windows reserves for devices", () => {
    expect(cookFilename("Con")).toBe("recipe-con.cook");
    expect(cookFilename("NUL")).toBe("recipe-nul.cook");
    expect(cookFilename("prn")).toBe("recipe-prn.cook");
    expect(cookFilename("Aux!")).toBe("recipe-aux.cook");
    expect(cookFilename("COM1")).toBe("recipe-com1.cook");
    expect(cookFilename("com9")).toBe("recipe-com9.cook");
    expect(cookFilename("LPT1")).toBe("recipe-lpt1.cook");
    expect(cookFilename("lpt9")).toBe("recipe-lpt9.cook");
  });

  it("leaves names that only resemble reserved ones", () => {
    expect(cookFilename("Con Carne")).toBe("con-carne.cook");
    expect(cookFilename("com10")).toBe("com10.cook");
    expect(cookFilename("com0")).toBe("com0.cook");
    expect(cookFilename("console")).toBe("console.cook");
  });
});
