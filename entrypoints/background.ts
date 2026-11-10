import { clientFor, convert } from "../lib/api";
import { clearSession, getSession } from "../lib/auth";
import { clipInFlight, runClip, type ClipDeps } from "../lib/clip";
import { saveCook } from "../lib/download";
import { setJob } from "../lib/jobs";
import type { Message } from "../lib/messages";

const deps: ClipDeps = {
  convert: (payload, token) => convert(payload, token),
  getSession,
  clearSession,
  setJob,
  saveCook,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  client: clientFor(import.meta.env.BROWSER),
};

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    if (message?.type === "clip") {
      // Answers false when the tab already has a clip running (a double click).
      runClip(message.request, deps).then(sendResponse, () => sendResponse(false));
      return true; // answer asynchronously; keeps the worker alive for the request
    }
    if (message?.type === "download") {
      saveCook(message.cooklang, message.filename).then(sendResponse, () => sendResponse(false));
      return true;
    }
    if (message?.type === "status") {
      // False after the browser stopped the worker mid-request: the set is in memory.
      sendResponse(clipInFlight(message.tabId));
      return undefined;
    }
    return undefined;
  });
});
