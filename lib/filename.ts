const MAX_STEM = 80;

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
  return `${stem || "recipe"}.cook`;
}
