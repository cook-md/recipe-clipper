import { defineConfig } from "wxt";

export default defineConfig({
  manifest: ({ browser }) => ({
    name: "Cooklang Recipe Clipper",
    description: "Save the recipe on this page as a Cooklang .cook file.",
    // activeTab + scripting: read the tab only when the toolbar button is clicked,
    // so there is no "read your data on all websites" install warning.
    permissions: ["activeTab", "scripting", "storage", "downloads"],
    host_permissions: ["https://cook.md/*"],
    // The recipe extractors are WebAssembly, run in the popup ('wasm-unsafe-eval').
    // img-src: the popup never loads an image from a page-supplied URL, so nothing
    // leaves the browser before the person clicks convert.
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; img-src 'self' data:;",
    },
    // 103: 'wasm-unsafe-eval' in an MV3 extension page CSP, storage.session (102).
    minimum_chrome_version: "103",
    // Chrome warns about keys it doesn't know, so this goes in the Firefox build only.
    ...(browser === "firefox" && {
      browser_specific_settings: {
        // 127: the first Firefox that grants host_permissions at install.
        gecko: { id: "clipper@cooklang.org", strict_min_version: "127.0" },
      },
    }),
  }),
});
