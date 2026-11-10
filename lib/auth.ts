export interface Session {
  token: string;
  email: string;
}

/**
 * Sign-in survives the popup closing: the person leaves to read the code in their
 * email, and the popup must reopen on the code step.
 */
export type PendingSignIn = { step: "email" } | { step: "code"; email: string };

export async function getSession(): Promise<Session | null> {
  return ((await browser.storage.local.get("session")).session as Session | undefined) ?? null;
}

export async function saveSession(session: Session): Promise<void> {
  await browser.storage.local.set({ session });
}

export async function clearSession(): Promise<void> {
  await browser.storage.local.remove("session");
}

/** The worker signs out on its own when the token has expired or is refused. */
export function onSessionChange(callback: (session: Session | null) => void): void {
  browser.storage.local.onChanged.addListener((changes) => {
    if (changes.session) callback((changes.session.newValue as Session | undefined) ?? null);
  });
}

export async function getPendingSignIn(): Promise<PendingSignIn | null> {
  return ((await browser.storage.local.get("pendingSignIn")).pendingSignIn as PendingSignIn | undefined) ?? null;
}

export async function setPendingSignIn(pending: PendingSignIn | null): Promise<void> {
  if (pending) await browser.storage.local.set({ pendingSignIn: pending });
  else await browser.storage.local.remove("pendingSignIn");
}
