export interface PageSnapshot {
  url: string;
  title: string;
  /** The whole document, for the structured-data extractors. */
  html: string;
  /** The user's text selection, if any. */
  selection: string;
  /** The page's readable text, for the "convert anyway" path. */
  text: string;
}

/**
 * Runs inside the page (scripting.executeScript serializes it), so everything it
 * needs is declared in its own body: no imports, no module-level helpers.
 *
 * The readable text is the page's rendered text (innerText): it skips hidden
 * elements, scripts and styles, and puts line breaks between blocks, so a list
 * stays a list. Where innerText is missing (jsdom), it falls back to the text of
 * a cleaned copy of the body. Line breaks are kept; spaces are collapsed.
 */
export function readPage(): PageSnapshot {
  const MAX_CHARS = 100_000;
  const tidy = (value: string) =>
    value
      .replace(/\r\n?/g, "\n")
      .replace(/[^\S\n]+/g, " ") // runs of spaces and tabs
      .replace(/ ?\n ?/g, "\n") // trim each line
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_CHARS);

  const rendered: unknown = document.body?.innerText;
  let text: string;
  if (typeof rendered === "string") {
    text = rendered;
  } else {
    const body = document.body ? (document.body.cloneNode(true) as HTMLElement) : null;
    body?.querySelectorAll("script, style, noscript, template, svg, iframe").forEach((node) => node.remove());
    text = body?.textContent ?? "";
  }

  return {
    url: location.href,
    title: document.title,
    html: document.documentElement.outerHTML,
    selection: tidy(getSelection()?.toString() ?? ""),
    text: tidy(text),
  };
}
