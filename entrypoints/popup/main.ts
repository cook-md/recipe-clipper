import "./style.css";
import type { Extraction } from "@cooklang/cooklang-import";
import { requestCode, verifyCode } from "../../lib/api";
import { clearSession, getPendingSignIn, getSession, saveSession, setPendingSignIn, type PendingSignIn, type Session } from "../../lib/auth";
import { extract } from "../../lib/extractor";
import { cookFilename } from "../../lib/filename";
import { clearJob, getJob, onJobChange, type Job } from "../../lib/jobs";
import type { ClipRequest, Message } from "../../lib/messages";
import { readPage, type PageSnapshot } from "../../lib/page-reader";
import { viewFor, type View } from "../../lib/view";
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

async function setPending(pending: PendingSignIn | null): Promise<void> {
  state.pending = pending;
  state.notice = "";
  await setPendingSignIn(pending);
  render();
}

const handlers: Handlers = {
  convert() {
    const { tabId, snapshot, extraction } = state;
    if (tabId === undefined || !snapshot) return;

    const request: ClipRequest = extraction
      ? {
          tabId,
          pageUrl: snapshot.url,
          filename: cookFilename(extraction.recipe.name),
          text: extraction.components.text,
          extracted: { name: extraction.components.name, metadata: extraction.components.metadata },
        }
      : {
          tabId,
          pageUrl: snapshot.url,
          filename: cookFilename(snapshot.title),
          text: snapshot.selection || snapshot.text,
        };

    state.notice = "";
    // The worker writes the job to session storage; onJobChange re-renders.
    void send({ type: "clip", request });
  },

  async copy(cooklang) {
    await navigator.clipboard.writeText(cooklang);
    state.notice = "Copied.";
    render();
  },

  async downloadAgain(cooklang, filename) {
    const saved = await send({ type: "download", cooklang, filename });
    if (!saved) {
      // No downloads API (Safari): save through a link from the popup itself.
      // octet-stream, not text/plain, so the browser keeps the .cook extension.
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([cooklang], { type: "application/octet-stream" }));
      link.download = filename;
      link.click();
    }
  },

  async retry() {
    if (state.tabId !== undefined) await clearJob(state.tabId);
    state.job = null;
    state.notice = "";
    render();
  },

  showSignIn() {
    void setPending({ step: "email" });
  },

  async submitEmail(email) {
    state.notice = "Sending the code…";
    render();
    const result = await requestCode(email);
    if (result.kind === "sent") await setPending({ step: "code", email });
    else {
      state.notice = result.message;
      render();
    }
  },

  async submitCode(code) {
    if (state.pending?.step !== "code") return;
    const { email } = state.pending;
    state.notice = "Signing in…";
    render();
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

async function start(): Promise<void> {
  render(); // "Reading the page…"

  [state.session, state.pending] = await Promise.all([getSession(), getPendingSignIn()]);

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
    state.snapshot = (injection?.result as PageSnapshot | undefined) ?? null;
  } catch {
    state.snapshot = null; // browser pages, the extension stores, PDFs
  }
  render();

  state.extraction = state.snapshot ? await extract(state.snapshot.html, state.snapshot.url) : null;
  render();
}

void start();
