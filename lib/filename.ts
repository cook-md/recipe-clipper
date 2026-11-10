const MAX_STEM = 80;
/** Device names Windows refuses as a file name whatever the extension; Chrome rejects the download. */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

/** A safe `.cook` file name for a recipe title. */
export function cookFilename(title: string): string {
  const stem = title
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "") // combining marks left behind by NFKD
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_STEM)
    .replace(/-+$/, "");
  if (!stem) return "recipe.cook";
  return `${WINDOWS_RESERVED.test(stem) ? `recipe-${stem}` : stem}.cook`;
}
