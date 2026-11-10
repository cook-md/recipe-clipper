import type { Session } from "../../lib/auth";
import type { View } from "../../lib/view";

export interface Handlers {
  convert(): void;
  copy(cooklang: string): void;
  downloadAgain(cooklang: string, filename: string): void;
  retry(): void;
  showSignIn(): void;
  submitEmail(email: string): void;
  submitCode(code: string): void;
  cancelSignIn(): void;
  signOut(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label: string, onClick: () => void, className = ""): HTMLButtonElement {
  const node = el("button", className, label);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function actions(...buttons: HTMLElement[]): HTMLElement {
  const row = el("div", "actions");
  row.append(...buttons);
  return row;
}

function list(tag: "ul" | "ol", items: string[]): HTMLElement {
  const node = el(tag);
  for (const item of items) node.append(el("li", "", item));
  return node;
}

function form(placeholder: string, type: string, submitLabel: string, onSubmit: (value: string) => void): HTMLFormElement {
  const node = el("form");
  const input = el("input");
  input.type = type;
  input.placeholder = placeholder;
  input.required = true;
  input.autofocus = true;
  node.append(input, actions(Object.assign(el("button", "primary", submitLabel), { type: "submit" })));
  node.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit(input.value.trim());
  });
  return node;
}

export function renderView(root: HTMLElement, view: View, notice: string, handlers: Handlers): void {
  const nodes: (HTMLElement | string)[] = [];

  switch (view.kind) {
    case "loading":
      nodes.push(el("p", "meta", "Reading the page…"));
      break;

    case "unreadable":
      nodes.push(el("h1", "", "Can't read this page"), el("p", "", "Browser pages, extension stores and PDFs can't be clipped. Open a recipe on a website and try again."));
      break;

    case "preview": {
      const { recipe } = view;
      nodes.push(el("h1", "", recipe.name || "Untitled recipe"));
      // The JSON-LD extractor writes "prep time"; the MicroData one writes "prep_time".
      const facts = ["servings", "prep time", "prep_time", "cook time", "cook_time", "time required", "total_time"]
        .filter((key) => recipe.metadata[key])
        .map((key) => `${key.replace("_", " ")}: ${recipe.metadata[key]}`);
      if (facts.length) nodes.push(el("div", "meta", facts.join(" · ")));
      const scroll = el("div", "scroll");
      // No recipe photo: loading a page-supplied URL would tell that server about
      // the visit before the person has clicked anything. The CSP forbids it too.
      scroll.append(
        el("h2", "", "Ingredients"),
        list("ul", recipe.ingredients),
        el("h2", "", "Steps"),
        list("ol", recipe.instructions.split(/\n+/).map((step) => step.trim()).filter(Boolean)),
      );
      nodes.push(scroll, actions(button("Convert & download .cook", handlers.convert, "primary")), el("div", "meta", view.filename));
      break;
    }

    case "no-recipe":
      nodes.push(
        el("h1", "", "No recipe data found on this page"),
        el(
          "p",
          "",
          view.hasSelection
            ? "The selected text will be sent to cook.md and converted."
            : "The page's text can still be sent to cook.md and converted. Select just the recipe first for a cleaner result.",
        ),
        actions(button(view.hasSelection ? "Convert selection" : "Convert this page anyway", handlers.convert, "primary")),
      );
      break;

    case "converting":
      nodes.push(el("h1", "", "Converting…"), el("p", "", "This takes a few seconds. You can close this window; the file will still be saved."));
      break;

    case "done":
      nodes.push(
        el("h1", "", view.downloaded ? "Saved to Downloads" : "Converted"),
        el("div", "meta", view.filename),
        el("pre", "", view.cooklang),
        actions(
          button("Copy", () => handlers.copy(view.cooklang)),
          button(view.downloaded ? "Download again" : "Save .cook", () => handlers.downloadAgain(view.cooklang, view.filename), view.downloaded ? "" : "primary"),
        ),
      );
      break;

    case "rate-limited":
      if (view.signedIn) {
        nodes.push(el("h1", "", "One moment"), el("p", "", `Try again in ${view.seconds} seconds.`));
      } else {
        nodes.push(
          el("h1", "", "One clip a minute without an account"),
          el("p", "", `You can clip again in ${view.seconds} seconds, or sign in for free to keep going.`),
          actions(button("Sign in for free", handlers.showSignIn, "primary")),
        );
      }
      break;

    case "error":
      nodes.push(el("h1", "", "That didn't work"), el("p", "error", view.message), actions(button("Try again", handlers.retry, "primary")));
      break;

    case "sign-in-email":
      nodes.push(
        el("h1", "", "Sign in for free"),
        el("p", "", "Enter your email and we'll send a 6-digit code. New here? This creates your cook.md account."),
        form("you@example.com", "email", "Send code", handlers.submitEmail),
        actions(button("Cancel", handlers.cancelSignIn, "link")),
      );
      break;

    case "sign-in-code":
      nodes.push(
        el("h1", "", "Check your email"),
        el("p", "", `Enter the code sent to ${view.email}.`),
        form("123456", "text", "Sign in", handlers.submitCode),
        actions(button("Use a different email", handlers.cancelSignIn, "link")),
      );
      break;
  }

  nodes.push(el("div", "notice", notice));
  root.replaceChildren(...nodes);
}

export function renderFooter(root: HTMLElement, session: Session | null, view: View, handlers: Handlers): void {
  const left = el("span", "", session ? session.email : "Not signed in");
  const signingIn = view.kind === "sign-in-email" || view.kind === "sign-in-code";
  const right = session
    ? button("Sign out", handlers.signOut, "link")
    : signingIn
      ? el("span")
      : button("Sign in for free", handlers.showSignIn, "link");
  root.replaceChildren(left, right);
}
