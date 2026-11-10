export interface Session {
  token: string;
  email: string;
}

/**
 * The code step of sign-in. It is the only step that is stored: the person leaves
 * the popup to read the code in their email, and the popup must reopen here. It is
 * ignored and removed once it is older than the code is useful for (see
 * pendingCodeExpired in view.ts).
 */
export interface PendingCode {
  step: "code";
  email: string;
  /** When the code was last requested, in ms. */
  requestedAt: number;
}

/** Sign-in as the popup holds it. The email step lives in the popup's memory only. */
export type PendingSignIn = { step: "email" } | PendingCode;

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

export async function getPendingCode(): Promise<PendingCode | null> {
  const stored = (await browser.storage.local.get("pendingSignIn")).pendingSignIn as Partial<PendingCode> | undefined;
  return stored?.step === "code" && typeof stored.email === "string" ? (stored as PendingCode) : null;
}

export async function setPendingCode(pending: PendingCode | null): Promise<void> {
  if (pending) await browser.storage.local.set({ pendingSignIn: pending });
  else await browser.storage.local.remove("pendingSignIn");
}
