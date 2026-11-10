# Privacy

Cooklang Recipe Clipper reads a web page only when you click its toolbar button, and
only the tab you clicked it on.

**What stays in your browser.** The preview (title, times, servings, ingredients and
steps) is computed locally from the page. Nothing is sent anywhere to show it. The
preview has no photo on purpose: loading one would tell the site hosting the image about
your visit, so the extension is not allowed to load remote images at all.

**What is sent, and when.** When you click a convert button, the extension sends to
cook.md:

- the recipe it found on the page (name, ingredients, steps, and details such as
  servings, times, author and source), or, if it found none, the text you selected or,
  with no selection, the page's readable text (up to 100,000 characters);
- the page's address, without anything after a `#`, so the saved recipe can cite its
  source;
- which browser build of the extension made the request (Chrome, Firefox or Safari).

As with any web request, cook.md also sees your IP address. It uses it to enforce the
limit of one clip a minute for requests without an account.

cook.md converts this to Cooklang and returns it, and the extension saves the file to
your Downloads folder. cook.md keeps the text you submitted, the page's address and the
converted recipe to review and improve conversion quality, whether or not you are signed
in; if you are signed in, they are linked to your account. Service providers that
cook.md uses to do the conversion receive the recipe text too. Both are described in the
[cook.md privacy policy](https://cook.md/privacy).

**Firefox sends an installation identifier.** Firefox adds an
`Origin: moz-extension://<id>` header to the extension's requests, and Firefox generates
that id once per installation. It is the same on every request from your copy of the
extension and different from everyone else's, so cook.md can tell that two requests came
from the same installation even when you are not signed in. The extension cannot remove
the header. Removing and reinstalling the extension gives it a new id. The Chrome build
has one id shared by everyone who installs it from the store, so it does not single out
an installation.

**Sign-in is optional.** If you sign in, your email address is sent to cook.md, which
emails you a login code; if there is no cook.md account for that address, one is created.
The extension then keeps your email address and a session token in its local storage,
and sends the token with each conversion. Signing out deletes both from the extension.

**What the extension keeps on your computer.** The sign-in details above; while you are
waiting for a login code, the email address you typed, for up to ten minutes; and the
conversion in progress or just finished for each tab (the page's address and the
converted recipe), which the browser discards when it closes. Removing the extension
removes all of it. The `.cook` files in your Downloads folder are ordinary files and stay.

**What is never collected.** Your browsing history, the pages you don't clip, and
anything from a page before you click a convert button. The only addresses cook.md
receives are those of the pages you convert. There is no analytics or telemetry in the
extension.
