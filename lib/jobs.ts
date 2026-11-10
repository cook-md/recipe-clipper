/** One clip per tab. Kept in session storage so it outlives the popup and the worker. */
export type Job =
  | { status: "converting"; pageUrl: string; filename: string; startedAt: number }
  | { status: "done"; pageUrl: string; filename: string; cooklang: string; downloaded: boolean }
  | { status: "rate_limited"; pageUrl: string; retryAt: number; signedIn: boolean }
  | { status: "error"; pageUrl: string; message: string };

const key = (tabId: number) => `job:${tabId}`;

export async function getJob(tabId: number): Promise<Job | null> {
  const k = key(tabId);
  return ((await browser.storage.session.get(k))[k] as Job | undefined) ?? null;
}

export async function setJob(tabId: number, job: Job): Promise<void> {
  await browser.storage.session.set({ [key(tabId)]: job });
}

export async function clearJob(tabId: number): Promise<void> {
  await browser.storage.session.remove(key(tabId));
}

export function onJobChange(tabId: number, callback: (job: Job | null) => void): void {
  browser.storage.session.onChanged.addListener((changes) => {
    const change = changes[key(tabId)];
    if (change) callback((change.newValue as Job | undefined) ?? null);
  });
}
