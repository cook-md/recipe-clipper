/**
 * The URL without its #fragment; the query string stays. The fragment is a
 * position on the page, not part of the recipe's address, so it is not sent as
 * the source URL.
 */
export function withoutFragment(url: string): string {
  const hash = url.indexOf("#");
  return hash === -1 ? url : url.slice(0, hash);
}
