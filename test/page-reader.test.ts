// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readPage } from "../lib/page-reader";

describe("readPage", () => {
  beforeEach(() => {
    document.title = "Pancakes | Example";
    document.body.innerHTML = `
      <h1>Pancakes</h1>
      <script>var tracking = "noise";</script>
      <style>.a { color: red }</style>
      <p>Whisk   the flour
         and eggs.</p>
      <noscript>enable js</noscript>`;
  });

  it("returns the document HTML, URL and title", () => {
    const page = readPage();
    expect(page.url).toBe(location.href);
    expect(page.title).toBe("Pancakes | Example");
    expect(page.html).toContain("<h1>Pancakes</h1>");
    expect(page.html.startsWith("<html")).toBe(true);
  });

  afterEach(() => {
    // jsdom has no innerText; some tests define it on this body.
    delete (document.body as any).innerText;
  });

  it("prefers the rendered text (innerText) and keeps its line breaks", () => {
    Object.defineProperty(document.body, "innerText", {
      configurable: true,
      get: () => "Pancakes\n\nIngredients\n1 egg  \n\t2 cups   flour\n\n\n\n\nMethod\r\nWhisk.\n",
    });
    expect(readPage().text).toBe("Pancakes\n\nIngredients\n1 egg\n2 cups flour\n\nMethod\nWhisk.");
  });

  it("falls back to the body's text without scripts or styles where innerText is missing", () => {
    expect(typeof (document.body as any).innerText).toBe("undefined");
    expect(readPage().text).toBe("Pancakes\n\nWhisk the flour\nand eggs.");
  });

  it("does not modify the page", () => {
    readPage();
    expect(document.querySelector("script")).not.toBeNull();
  });

  it("returns the current selection", () => {
    const p = document.querySelector("p")!;
    const range = document.createRange();
    range.selectNodeContents(p);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);

    expect(readPage().selection).toBe("Whisk the flour\nand eggs.");
  });

  it("caps the text", () => {
    document.body.innerHTML = `<p>${"word ".repeat(40_000)}</p>`;
    expect(readPage().text.length).toBe(100_000);
  });

  it("caps the rendered text too", () => {
    Object.defineProperty(document.body, "innerText", { configurable: true, get: () => "line\n".repeat(40_000) });
    expect(readPage().text.length).toBe(100_000);
  });
});
