import { clientFor, convert, type ConvertResult } from "../lib/api";
import { clearSession, getSession } from "../lib/auth";
import { saveCook } from "../lib/download";
import { setJob } from "../lib/jobs";
import type { ClipRequest, Message } from "../lib/messages";

/** With a valid token the limit is one request a second; a longer wait means the token was not accepted. */
const SIGNED_IN_MAX_RETRY_SECONDS = 2;

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    if (message?.type === "clip") {
      runClip(message.request).then(
        () => sendResponse(true),
        () => sendResponse(false),
      );
      return true; // answer asynchronously; keeps the worker alive for the request
    }
    if (message?.type === "download") {
      saveCook(message.cooklang, message.filename).then(sendResponse, () => sendResponse(false));
      return true;
    }
    return undefined;
  });
});

async function runClip(request: ClipRequest): Promise<void> {
  const { tabId, pageUrl, filename } = request;
  await setJob(tabId, { status: "converting", pageUrl, filename, startedAt: Date.now() });

  try {
    const session = await getSession();
    let signedIn = session !== null;
    let result = await attempt(request, session?.token);

    if (result.kind === "rate_limited" && signedIn) {
      if (result.retryAfter <= SIGNED_IN_MAX_RETRY_SECONDS) {
        await sleep(result.retryAfter * 1000);
        result = await attempt(request, session?.token);
      } else {
        // The server ignored the token (expired) and applied the anonymous limit.
        await clearSession();
        signedIn = false;
      }
    }

    if (result.kind === "ok") {
      const downloaded = await saveCook(result.cooklang, filename).catch(() => false);
      await setJob(tabId, { status: "done", pageUrl, filename, cooklang: result.cooklang, downloaded });
    } else if (result.kind === "rate_limited") {
      await setJob(tabId, { status: "rate_limited", pageUrl, retryAt: Date.now() + result.retryAfter * 1000, signedIn });
    } else {
      await setJob(tabId, { status: "error", pageUrl, message: result.message });
    }
  } catch (error) {
    await setJob(tabId, { status: "error", pageUrl, message: "Something went wrong. Try again." });
    throw error;
  }
}

function attempt(request: ClipRequest, token?: string): Promise<ConvertResult> {
  return convert(
    {
      text: request.text,
      sourceUrl: request.pageUrl,
      client: clientFor(import.meta.env.BROWSER),
      extracted: request.extracted,
    },
    token,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
