// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderView, type Handlers } from "../entrypoints/popup/render";

const handlers = new Proxy({}, { get: () => vi.fn() }) as Handlers;
let root: HTMLElement;

beforeEach(() => {
  root = document.createElement("main");
  document.body.replaceChildren(root);
});

const input = () => root.querySelector("input")!;
const notice = () => root.querySelector(".notice")!.textContent;
const labels = () => [...root.querySelectorAll("button")].map((button) => button.textContent);

describe("renderView, sign-in forms", () => {
  it("focuses the input when the email step appears", () => {
    renderView(root, { kind: "sign-in-email" }, "", handlers);
    expect(document.activeElement).toBe(input());
  });

  it("keeps what was typed when only the notice changes", () => {
    renderView(root, { kind: "sign-in-email" }, "", handlers);
    const field = input();
    field.value = "me@example.com";

    renderView(root, { kind: "sign-in-email" }, "Sending the code…", handlers);
    expect(input()).toBe(field);
    expect(field.value).toBe("me@example.com");
    expect(notice()).toBe("Sending the code…");

    renderView(root, { kind: "sign-in-email" }, "Email is invalid", handlers);
    expect(input()).toBe(field);
    expect(field.value).toBe("me@example.com");
    expect(notice()).toBe("Email is invalid");
  });

  it("builds a fresh, focused form when the step changes", () => {
    renderView(root, { kind: "sign-in-email" }, "", handlers);
    const emailField = input();
    emailField.value = "me@example.com";

    renderView(root, { kind: "sign-in-code", email: "me@example.com" }, "", handlers);
    expect(input()).not.toBe(emailField);
    expect(input().value).toBe("");
    expect(document.activeElement).toBe(input());

    input().value = "1234";
    renderView(root, { kind: "sign-in-code", email: "me@example.com" }, "That code didn't work. Check the email and try again.", handlers);
    expect(input().value).toBe("1234");
  });

  it("rebuilds the code step for a different email", () => {
    renderView(root, { kind: "sign-in-code", email: "a@example.com" }, "", handlers);
    input().value = "1234";
    renderView(root, { kind: "sign-in-code", email: "b@example.com" }, "", handlers);
    expect(input().value).toBe("");
    expect(root.textContent).toContain("b@example.com");
  });

  it("rebuilds after leaving sign-in and coming back", () => {
    renderView(root, { kind: "sign-in-email" }, "", handlers);
    input().value = "me@example.com";
    renderView(root, { kind: "loading" }, "", handlers);
    renderView(root, { kind: "sign-in-email" }, "", handlers);
    expect(input().value).toBe("");
  });

  it("offers resend, a different email and cancel on the code step", () => {
    const spies = { resendCode: vi.fn(), useDifferentEmail: vi.fn(), cancelSignIn: vi.fn() };
    renderView(root, { kind: "sign-in-code", email: "a@example.com" }, "", { ...handlers, ...spies });

    expect(labels()).toEqual(["Sign in", "Resend code", "Use a different email", "Cancel"]);
    for (const label of ["Resend code", "Use a different email", "Cancel"]) {
      [...root.querySelectorAll("button")].find((button) => button.textContent === label)!.click();
    }
    expect(spies.resendCode).toHaveBeenCalledTimes(1);
    expect(spies.useDifferentEmail).toHaveBeenCalledTimes(1);
    expect(spies.cancelSignIn).toHaveBeenCalledTimes(1);
  });
});

describe("renderView, done", () => {
  it("offers to clip again", () => {
    const clipAgain = vi.fn();
    renderView(root, { kind: "done", cooklang: "Roast.", filename: "x.cook", downloaded: true }, "", { ...handlers, clipAgain });

    expect(labels()).toEqual(["Copy", "Download again", "Clip again"]);
    [...root.querySelectorAll("button")].find((button) => button.textContent === "Clip again")!.click();
    expect(clipAgain).toHaveBeenCalledTimes(1);
  });
});

describe("renderView, page-derived text", () => {
  it("shows markup in recipe fields as text", () => {
    const recipe = { name: "<img src=x onerror=alert(1)>", description: null, image: ["https://example.com/a.jpg"], ingredients: ["<b>2</b> eggs"], instructions: "Boil <i>it</i>.", metadata: {} };
    renderView(root, { kind: "preview", recipe, filename: "x.cook" }, "", handlers);

    expect(root.querySelector("img, b, i")).toBeNull();
    expect(root.querySelector("h1")!.textContent).toBe("<img src=x onerror=alert(1)>");
  });
});
