# Store listing draft

**Name:** Cooklang Recipe Clipper

**Summary (132 characters max):**
Save the recipe on any page as a plain-text Cooklang .cook file. See it first, convert in one click, keep the file.

**Description:**

I keep my recipes as plain text files in Cooklang, and the slow part was always getting
them in: copy the address, paste it into a converter, download the file. This extension
does that from the page itself.

Open a recipe and click the button. You see what the page's recipe data contains: title,
times, servings, ingredients and steps, as text. Click convert, keep the popup open for a
few seconds, and a .cook file is saved to your Downloads folder.

- Works without an account (one clip a minute). Sign in for free with an emailed code to
  clip without waiting.
- Reads the page you already have open, so it also works on sites that block automated
  importers.
- If a page has no recipe data, you can convert the text you select, or the whole page's
  text.
- Nothing leaves your browser until you click convert. Then the recipe (or the text) and
  the page's address go to cook.md, which does the conversion. It needs a connection.
- The result is a plain text file on your disk, readable in any editor and usable in the
  Cooklang apps and CookCLI.

Source code: https://github.com/cook-md/recipe-clipper

Privacy: https://github.com/cook-md/recipe-clipper/blob/main/PRIVACY.md

**Category:** Productivity (Chrome) / Other (Firefox)

**Single purpose (Chrome):** Convert the recipe on the current page to a Cooklang file.

**Permission justifications (Chrome):**
- activeTab, scripting: read the current page's HTML, text and selection when the user clicks the toolbar button, to find the recipe.
- downloads: save the converted .cook file.
- storage: keep the optional sign-in token and email, and the in-progress conversion.
- Host permission cook.md: send the recipe to the cook.md conversion API and sign in.
- Remote code: none. The WebAssembly extractors are packaged in the extension.

**Data disclosure (Chrome):** website content (the recipe or page text the user chooses
to convert); web history only in the sense that the address of each converted page is
sent with it; and, if the user signs in, personally identifiable information (email
address) and authentication information (a session token). Not sold, not used for
anything other than the conversion and the account.

**Data collection (Firefox):** declared in the manifest
(`browser_specific_settings.gecko.data_collection_permissions`), all as required:
`websiteContent`, `browsingActivity` (the address of each converted page),
`personallyIdentifyingInfo` (email address, sign-in only), `authenticationInfo` (session
token, sign-in only). Note for the reviewer: requests from Firefox carry an
`Origin: moz-extension://<id>` header whose id is unique to the installation; PRIVACY.md
says so.
