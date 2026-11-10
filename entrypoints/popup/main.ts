import "./style.css";
import type { Extraction } from "@cooklang/cooklang-import";
import { requestCode, verifyCode } from "../../lib/api";
import { clearSession, getPendingCode, getSession, onSessionChange, saveSession, setPendingCode, type PendingSignIn, type Session } from "../../lib/auth";
import { extract } from "../../lib/extractor";
import { ACCESS_NEEDED, createHostAccess } from "../../lib/host-access";
import { snapshotFromInjection } from "../../lib/injection";
import { clearJob, getJob, onJobChange, setJob, type Job } from "../../lib/jobs";
import type { Message } from "../../lib/messages";
import { readPage, type PageSnapshot } from "../../lib/page-reader";
import { clipRequestFor } from "../../lib/request";
import { pendingCodeExpired, viewFor, type View } from "../../lib/view";
import { renderFooter, renderView, type Handlers } from "./render";

const app = document.querySelector<HTMLElement>("#app")!;
const footer = document.querySelector<HTMLElement>("#footer")!;

const state = {
  tabId: undefined as number | undefined,
  snapshot: undefined as PageSnapshot | null | undefined,
  extraction: undefined as Extraction | null | undefined,
  job: null as Job | null,
  pending: null as PendingSignIn | null,
  session: null as Session | null,
  notice: "",
};

let ticker: ReturnType<typeof setInterval> | undefined;

function currentView(): View {
  return viewFor({ snapshot: state.snapshot, extraction: state.extraction, job: state.job, pending: state.pending, now: Date.now() });
}

function render(): void {
  const view = currentView();
  renderView(app, view, state.notice, handlers);
  renderFooter(footer, state.session, view, handlers);

  // Re-render once a second while a countdown or a stuck-conversion check is on screen.
  const ticking = view.kind === "rate-limited" || view.kind === "converting";
  if (ticking && !ticker) ticker = setInterval(render, 1000);
  if (!ticking && ticker) {
    clearInterval(ticker);
    ticker = undefined;
  }
}

function send(message: Message): Promise<unknown> {
  return browser.runtime.sendMessage(message);
}

/** Move to a sign-in step (or out of sign-in). Only the code step is stored. */
async function setPending(pending: PendingSignIn | null, notice = ""): Promise<void> {
  state.pending = pending;
  state.notice = notice;
  render();
  await setPendingCode(pending?.step === "code" ? pending : null);
}

/** One request to cook.md at a time from the sign-in forms. */
let signInBusy = false;
async function signInRequest(notice: string, work: () => Promise<void>): Promise<void> {
  if (signInBusy) return;
  signInBusy = true;
  state.notice = notice;
  render();
  try {
    await work();
  } finally {
    signInBusy = false;
  }
}

/**
 * Run `action`, which talks to cook.md, once the extension may. Call it
 * synchronously from the click or submit handler: when access is missing (Safari,
 * until the person allows cook.md) the browser's prompt needs the user gesture.
 */
const hostAccess = createHostAccess(browser.permissions);
function withHostAccess(action: () => void): void {
  hostAccess.run(action, () => {
    state.notice = ACCESS_NEEDED;
    render();
  });
}

const UNREACHABLE_WORKER = "Couldn't reach the extension's background process. Try again.";

/** Forget this tab's job and show the page view again ("Try again", "Clip again"). */
async function backToPage(): Promise<void> {
  if (state.tabId !== undefined) await clearJob(state.tabId);
  state.job = null;
  state.notice = "";
  render();
}

const handlers: Handlers = {
  convert() {
    const { tabId, snapshot, extraction } = state;
    if (tabId === undefined || !snapshot || extraction === undefined) return;

    state.notice = "";
    const request = clipRequestFor(tabId, snapshot, extraction);
    if (!request) {
      // Nothing to send: say so here instead of asking the server.
      state.job = { status: "error", pageUrl: snapshot.url, message: "There's no text on this page to convert." };
      render();
      return;
    }

    withHostAccess(() => {
      // Show "Converting…" at once, so the button is gone before a second click can
      // land. The worker writes the same job to session storage, then the outcome;
      // onJobChange re-renders.
      const local: Job = { status: "converting", pageUrl: request.pageUrl, filename: request.filename, startedAt: Date.now() };
      state.job = local;
      state.notice = "";
      render();
      send({ type: "clip", request }).catch(() => {
        if (state.job === local) state.job = null; // the worker never took it
        state.notice = UNREACHABLE_WORKER;
        render();
      });
    });
  },

  async copy(cooklang) {
    try {
      await navigator.clipboard.writeText(cooklang);
      state.notice = "Copied.";
    } catch {
      state.notice = "Couldn't copy. Select the text and copy it manually.";
    }
    render();
  },

  async downloadAgain(cooklang, filename) {
    let saved: unknown;
    try {
      saved = await send({ type: "download", cooklang, filename });
    } catch {
      state.notice = UNREACHABLE_WORKER;
      render();
      return;
    }
    if (!saved) {
      // No downloads API (Safari): save through a link from the popup itself.
      // octet-stream, not text/plain, so the browser keeps the .cook extension.
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([cooklang], { type: "application/octet-stream" }));
      link.download = filename;
      link.click();
    }
  },

  retry: backToPage,
  clipAgain: backToPage,

  showSignIn() {
    void setPending({ step: "email" });
  },

  submitEmail(email) {
    withHostAccess(() => {
      void signInRequest("Sending the code…", async () => {
        const result = await requestCode(email);
        if (state.pending?.step !== "email") return; // cancelled while the request was out
        if (result.kind === "sent") await setPending({ step: "code", email, requestedAt: Date.now() });
        else {
          state.notice = result.message;
          render();
        }
      });
    });
  },

  submitCode(code) {
    if (state.pending?.step !== "code") return;
    const { email } = state.pending;
    withHostAccess(() => {
      void signInRequest("Signing in…", async () => {
        const result = await verifyCode(email, code);
        if (result.kind !== "ok") {
          state.notice = result.message;
          render();
          return;
        }
        state.session = { token: result.token, email };
        await saveSession(state.session);
        // A rate-limit wall from before sign-in no longer applies.
        if (state.job?.status === "rate_limited" && state.tabId !== undefined) {
          await clearJob(state.tabId);
          state.job = null;
        }
        await setPending(null);
      });
    });
  },

  resendCode() {
    if (state.pending?.step !== "code") return;
    const { email } = state.pending;
    withHostAccess(() => {
      void signInRequest("Sending the code…", async () => {
        const result = await requestCode(email);
        if (state.pending?.step !== "code" || state.pending.email !== email) return; // left the step meanwhile
        if (result.kind === "sent") await setPending({ step: "code", email, requestedAt: Date.now() }, "Code sent.");
        else {
          state.notice = result.message;
          render();
        }
      });
    });
  },

  useDifferentEmail() {
    void setPending({ step: "email" });
  },

  cancelSignIn() {
    void setPending(null);
  },

  async signOut() {
    await clearSession();
    state.session = null;
    render();
  },
};

/**
 * A "converting" job found on opening may be an orphan: the browser stops the
 * worker (and drops its request) about 30 s after the popup closes. The worker
 * knows which tabs it is still working for; if this one is not among them, say so
 * now instead of waiting for the 90 s check in viewFor.
 */
async function checkInterrupted(tabId: number): Promise<void> {
  const stored = state.job;
  if (stored?.status !== "converting" || stored.pageUrl !== state.snapshot?.url) return;

  let running: unknown;
  try {
    running = await send({ type: "status", tabId });
  } catch {
    return; // no answer: the 90 s check still applies
  }
  if (running !== false) return;

  // The clip may have finished between the two reads: look again before deciding.
  const latest = await getJob(tabId);
  if (latest?.status !== "converting" || latest.startedAt !== stored.startedAt) {
    state.job = latest;
  } else {
    state.job = { status: "error", pageUrl: latest.pageUrl, message: "The conversion was interrupted. Try again." };
    await setJob(tabId, state.job);
  }
  render();
}

async function start(): Promise<void> {
  render(); // "Reading the page…"
  // Not awaited: it only has to answer before the first click, and a click that
  // beats it asks the browser directly.
  void hostAccess.refresh();

  const [session, pendingCode] = await Promise.all([getSession(), getPendingCode()]);
  state.session = session;
  if (pendingCode && pendingCodeExpired(pendingCode, Date.now())) await setPendingCode(null);
  else state.pending = pendingCode;
  // Keep the footer honest when the worker drops an expired or refused session.
  onSessionChange((session) => {
    state.session = session;
    render();
  });

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) {
    state.snapshot = null;
    state.extraction = null;
    render();
    return;
  }
  state.tabId = tab.id;
  state.job = await getJob(tab.id);
  onJobChange(tab.id, (job) => {
    state.job = job;
    render();
  });

  try {
    const [injection] = await browser.scripting.executeScript({ target: { tabId: tab.id }, func: readPage });
    state.snapshot = snapshotFromInjection(injection);
  } catch {
    state.snapshot = null; // browser pages, the extension stores, PDFs
  }
  render();
  void checkInterrupted(tab.id);

  state.extraction = state.snapshot ? await extract(state.snapshot.html, state.snapshot.url) : null;
  render();
}

void start();
