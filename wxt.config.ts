import { defineConfig } from "wxt";

export default defineConfig({
  manifest: ({ browser }) => ({
    name: "Cooklang Recipe Clipper",
    description: "Save the recipe on this page as a Cooklang .cook file.",
    // activeTab + scripting: read the tab only when the toolbar button is clicked,
    // so there is no "read your data on all websites" install warning.
    // Safari has no downloads API: there the file is written by the containing app's
    // extension handler, reached with a native message (lib/download.ts, safari/).
    permissions: ["activeTab", "scripting", "storage", browser === "safari" ? "nativeMessaging" : "downloads"],
    host_permissions: ["https://cook.md/*"],
    // The recipe extractors are WebAssembly, run in the popup ('wasm-unsafe-eval').
    // img-src: the popup never loads an image from a page-supplied URL, so nothing
    // leaves the browser before the person clicks convert.
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; img-src 'self' data:;",
    },
    // 103: 'wasm-unsafe-eval' in an MV3 extension page CSP, storage.session (102).
    // Safari gets neither this key nor the Firefox one below; its minimum version is
    // the macOS deployment target of the Xcode project in safari/.
    ...(browser !== "safari" && { minimum_chrome_version: "103" }),
    // Chrome warns about keys it doesn't know, so this goes in the Firefox build only.
    ...(browser === "firefox" && {
      browser_specific_settings: {
        // 140: the first Firefox with built-in consent for the data collection
        // declared below; on older versions the extension would have to show its own
        // consent screen. (Host permissions are granted at install since 127.)
        gecko: {
          id: "clipper@cooklang.org",
          strict_min_version: "140.0",
          // What leaves the browser, in addons.mozilla.org's categories (Firefox 140+
          // shows them in the install prompt). On every convert: the recipe or page
          // text (websiteContent) and the page's address (browsingActivity). On
          // sign-in: the email address (personallyIdentifyingInfo) and the session
          // token (authenticationInfo). Sign-in is optional, but these two are listed
          // as required because `optional` means "granted through
          // permissions.request()", and the sign-in form does not ask that way.
          data_collection_permissions: {
            required: ["websiteContent", "browsingActivity", "personallyIdentifyingInfo", "authenticationInfo"],
          },
        },
      },
    }),
  }),
});
