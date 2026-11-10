import { afterEach, describe, expect, it, vi } from "vitest";
import { NATIVE_TIMEOUT_MS, saveWith } from "../lib/save";

afterEach(() => vi.useRealTimers());

describe("saveWith", () => {
  it("uses the downloads API when there is one, and never the native app", async () => {
    const download = vi.fn(async () => {});
    const sendNative = vi.fn(async () => ({ ok: true }));

    expect(await saveWith("Roast.", "roast.cook", { download, sendNative })).toBe(true);

    expect(download).toHaveBeenCalledWith("Roast.", "roast.cook");
    expect(sendNative).not.toHaveBeenCalled();
  });

  it("lets a downloads API failure through (runClip records it)", async () => {
    const download = vi.fn(async () => {
      throw new Error("Invalid filename");
    });
    await expect(saveWith("Roast.", "roast.cook", { download })).rejects.toThrow("Invalid filename");
  });

  it("without a downloads API, sends the file to the native app", async () => {
    const sendNative = vi.fn(async () => ({ ok: true, filename: "roast (1).cook" }));

    expect(await saveWith("Roast the @chicken{8}.", "roast.cook", { sendNative })).toBe(true);

    expect(sendNative).toHaveBeenCalledWith({ type: "save-cook", filename: "roast.cook", text: "Roast the @chicken{8}." });
  });

  it.each([{ ok: false, error: "bad_name" }, { ok: "yes" }, {}, null, undefined, "ok"])("is false when the app answers %j", async (reply) => {
    expect(await saveWith("Roast.", "roast.cook", { sendNative: async () => reply })).toBe(false);
  });

  it("is false when the native message fails", async () => {
    const sendNative = vi.fn(async () => {
      throw new Error("no handler");
    });
    expect(await saveWith("Roast.", "roast.cook", { sendNative })).toBe(false);
  });

  it("is false when the app never answers", async () => {
    vi.useFakeTimers();
    const saved = saveWith("Roast.", "roast.cook", { sendNative: () => new Promise(() => {}) });
    await vi.advanceTimersByTimeAsync(NATIVE_TIMEOUT_MS);
    expect(await saved).toBe(false);
  });

  it("is false when there is nowhere to save", async () => {
    expect(await saveWith("Roast.", "roast.cook", {})).toBe(false);
  });
});
