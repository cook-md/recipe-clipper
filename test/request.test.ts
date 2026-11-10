import { describe, expect, it } from "vitest";
import { clipRequestFor } from "../lib/request";

const snapshot = { url: "https://example.com/r#top", title: "Granny's pancakes", html: "<html></html>", selection: "", text: "1 egg\n2 cups flour" };
const extraction = {
  recipe: { name: "Lemon Chicken", description: null, image: [], ingredients: ["8 chicken thighs"], instructions: "Roast.", metadata: {} },
  components: { name: "Lemon Chicken", metadata: "servings: 4\n", text: "8 chicken thighs\n\nRoast." },
};

describe("clipRequestFor", () => {
  it("sends the extracted recipe when there is one", () => {
    expect(clipRequestFor(7, snapshot, extraction)).toEqual({
      tabId: 7,
      pageUrl: "https://example.com/r#top",
      filename: "lemon-chicken.cook",
      text: "8 chicken thighs\n\nRoast.",
      extracted: { name: "Lemon Chicken", metadata: "servings: 4\n" },
    });
  });

  it("sends the page text when there is no recipe", () => {
    expect(clipRequestFor(7, snapshot, null)).toEqual({ tabId: 7, pageUrl: snapshot.url, filename: "granny-s-pancakes.cook", text: "1 egg\n2 cups flour" });
  });

  it("prefers the selection over the page text", () => {
    expect(clipRequestFor(7, { ...snapshot, selection: "2 eggs" }, null)?.text).toBe("2 eggs");
  });

  it("is null when there is nothing to send", () => {
    expect(clipRequestFor(7, { ...snapshot, text: "" }, null)).toBeNull();
    expect(clipRequestFor(7, { ...snapshot, text: " \n ", selection: " " }, null)).toBeNull();
  });
});
