// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
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

  it("returns readable text without scripts, styles or extra whitespace", () => {
    expect(readPage().text).toBe("Pancakes Whisk the flour and eggs.");
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

    expect(readPage().selection).toContain("Whisk");
  });

  it("caps the text", () => {
    document.body.innerHTML = `<p>${"word ".repeat(40_000)}</p>`;
    expect(readPage().text.length).toBe(100_000);
  });
});
