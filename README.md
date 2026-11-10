# Cooklang Recipe Clipper

A browser extension for Chrome and Firefox that saves the recipe on the current page as
a [Cooklang](https://cooklang.org) `.cook` file.

## Status

Version 0.1.0, not yet in the Chrome Web Store or on addons.mozilla.org.

The project does not build from a fresh clone on another machine yet. It depends on
`@cooklang/cooklang-import` (the recipe extractors compiled to WebAssembly) through a
local path, `file:../cooklang-import-wasm/wasm`, because that package is not on npm yet.
Until it is published, `npm install` needs a built checkout of it next to this
directory, and the CI workflow in `.github/workflows/ci.yml` cannot pass.

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

Requires Node 22 or newer, and the local dependency described under Status.

```sh
npm install
npm run dev            # Chrome, with reload
npm run dev:firefox    # Firefox
npm test
npm run typecheck
npm run build && npm run build:firefox   # unpacked builds in .output/
npm run zip && npm run zip:firefox       # store packages in .output/
```

Layout: `entrypoints/` holds the popup and the background worker; `lib/` holds the logic,
most of it free of browser APIs and covered by `test/`. The manifest is generated from
`wxt.config.ts` ([WXT](https://wxt.dev)).

Minimum browser versions: Chrome 103, Firefox 140.

## License

MIT
