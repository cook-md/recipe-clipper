# Cooklang Recipe Clipper

A browser extension for Chrome, Firefox and Safari (macOS) that saves the recipe on the current page as
a [Cooklang](https://cooklang.org) `.cook` file.

## Status

Version 0.1.0, not yet in the Chrome Web Store or on addons.mozilla.org.

It has been run by hand in Chrome, Firefox and Safari 18.6 against cook.md, but not yet
through a full manual pass on many sites. Safari 18 refuses WebAssembly in extension
pages (WebKit bug 290153), so the Safari build also carries a plain-JavaScript
translation of the recipe reader (`npm run reader:js`) and falls back to it.

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
npm run build:safari                     # Safari web extension; see "Safari (macOS)"
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

Minimum browser versions: Chrome 103, Firefox 140, Safari 16.4 (the Safari app requires
macOS 13.3, the first macOS that ships with Safari 16.4).

## Safari (macOS)

Safari runs a web extension only from inside a Mac app. `safari/` holds that app's Xcode
project, generated with `xcrun safari-web-extension-converter` and then edited by hand:

- `Cooklang Recipe Clipper/`: the app. Its one window says whether the extension is on
  and opens Safari's settings.
- `Cooklang Recipe Clipper Extension/`: the extension target. Its resources are the
  files of `.output/safari-mv3`, referenced by relative path, so build the web extension
  first. The project lists the top-level entries of that folder (`manifest.json`,
  `background.js`, `popup.html`, `assets/`, `chunks/`, `icon/`); if a build ever adds
  another, add it to the Resources group in Xcode.
- `CookFileSaver/`: Safari has no downloads API, so the extension sends the converted
  recipe to the app's extension handler (`browser.runtime.sendNativeMessage`), which
  writes it into the Downloads folder. That code is a Swift package so it can be tested;
  the extension target compiles the same source file.

Build (Xcode 15 or newer):

```sh
npm ci
npm run build:safari        # the web extension, in .output/safari-mv3
npm run build:safari-app    # the same, then the app, in safari/build/Build/Products/Release/
(cd safari/CookFileSaver && swift test)
```

The project signs ad hoc ("Sign to Run Locally"), so it builds on any Mac. Safari only
loads an ad-hoc signed extension while Develop → Allow Unsigned Extensions is on (turn on
"Show features for web developers" in Safari → Settings → Advanced to get the Develop
menu; the setting resets when Safari quits). To sign with your own certificate instead,
pass the identity to `xcodebuild`, for example
`CODE_SIGN_IDENTITY="Developer ID Application: …" DEVELOPMENT_TEAM=…`, or set a team in
Xcode.

Enable it:

1. Open `safari/build/Build/Products/Release/Cooklang Recipe Clipper.app` once. Safari
   learns about the extension from the app.
2. Safari → Settings → Extensions → tick Cooklang Recipe Clipper.
3. The first time you convert a recipe or sign in, Safari asks whether the extension may
   access cook.md. Choose Always Allow. (Chrome and Firefox grant this at install; Safari
   asks.) Until it is allowed the popup says "Allow access to cook.md to convert
   recipes."

The Safari build differs from the others in two places: the manifest has `nativeMessaging`
instead of `downloads`, and the file is written by the app as described above. If that
fails, the popup's "Save .cook" button falls back to a download link.

## License

MIT
