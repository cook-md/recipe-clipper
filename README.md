# Cooklang Recipe Clipper

A browser extension for Chrome and Firefox that saves the recipe on the current page as
a [Cooklang](https://cooklang.org) `.cook` file.

## Status

Version 0.1.0, not yet in the Chrome Web Store or on addons.mozilla.org.

It has been run in headless Chrome and Firefox against a mock server, but not yet
through a full manual pass on real sites.

## What it does

Click the toolbar button on a recipe page. The popup shows the recipe it found: title,
times, servings, ingredients and steps (no photo). One more click sends it to
[cook.md](https://cook.md), which converts it to Cooklang, and the `.cook` file is saved
to your Downloads folder. Keep the popup open while it converts; the browser can stop
the request if you close it.

If the page has no recipe data the extractors recognise, you can still convert the text
you have selected, or the whole page's text.

- No account needed. Without one you can clip once a minute; signing in for free, with a
  code sent to your email, removes the wait.
- The page is read only when you click the button, and only the current tab (`activeTab`
  and `scripting`; no access to all sites).
- The preview is computed in your browser. Nothing is sent until you click a convert
  button. [PRIVACY.md](PRIVACY.md) lists what is sent then.
- Recipes are found with the same extractors as
  [cooklang-import](https://github.com/cooklang/cooklang-import), compiled to
  WebAssembly. The conversion to Cooklang is done by cook.md, so the extension does not
  work offline.

## Development

Requires Node 22 or newer.

```sh
npm install
npm run dev            # dev build for Chrome in .output/chrome-mv3-dev, rebuilt on change
npm run dev:firefox    # same for Firefox
npm test
npm run typecheck
npm run build && npm run build:firefox   # unpacked builds in .output/
npm run zip && npm run zip:firefox       # store packages in .output/
```

Neither command opens a browser. Load the build by hand:

- **Chrome:** `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3`
  (or `.output/chrome-mv3-dev` while `npm run dev` is running).
- **Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
  `.output/firefox-mv3/manifest.json`.

Layout: `entrypoints/` holds the popup and the background worker; `lib/` holds the logic,
most of it free of browser APIs and covered by `test/`. The manifest is generated from
`wxt.config.ts` ([WXT](https://wxt.dev)).

Minimum browser versions: Chrome 103, Firefox 140.

## License

MIT
