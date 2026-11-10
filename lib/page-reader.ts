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
 * needs is declared in its own body. The readable text mirrors what the server
 * does for URL imports: body text without script/style machinery, whitespace
 * collapsed, capped.
 */
export function readPage(): PageSnapshot {
  const MAX_CHARS = 100_000;
  const body = document.body ? (document.body.cloneNode(true) as HTMLElement) : null;
  body
    ?.querySelectorAll("script, style, noscript, template, svg, iframe")
    .forEach((node) => node.remove());
  const collapse = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);

  return {
    url: location.href,
    title: document.title,
    html: document.documentElement.outerHTML,
    selection: collapse(getSelection()?.toString() ?? ""),
    text: collapse(body?.textContent ?? ""),
  };
}
