import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Cooklang Recipe Clipper",
    description: "Save the recipe on this page as a Cooklang .cook file.",
    // activeTab + scripting: read the tab only when the toolbar button is clicked,
    // so there is no "read your data on all websites" install warning.
    permissions: ["activeTab", "scripting", "storage", "downloads"],
    host_permissions: ["https://cook.md/*"],
    // The recipe extractors are WebAssembly, run in the popup.
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    browser_specific_settings: {
      // 127: the first Firefox that grants host_permissions at install.
      gecko: { id: "clipper@cooklang.org", strict_min_version: "127.0" },
    },
  },
});
