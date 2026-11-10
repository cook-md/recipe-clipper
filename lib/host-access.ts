/** The one host the extension talks to; the same pattern as the manifest's host_permissions. */
export const COOK_MD_ACCESS = { origins: ["https://cook.md/*"] };

export const ACCESS_NEEDED = "Allow access to cook.md to convert recipes.";

/** The part of `browser.permissions` used here. */
export interface PermissionsApi {
  contains(permissions: { origins: string[] }): Promise<boolean>;
  request(permissions: { origins: string[] }): Promise<boolean>;
}

/**
 * Access to cook.md, checked before a click's first request.
 *
 * Chrome and Firefox grant the manifest's host permission at install, so there
 * this never asks (Firefox lets the person take it away later; then it asks).
 * Safari grants nothing at install: until the person allows the extension on
 * cook.md, its requests are blocked.
 *
 * Browsers only show the prompt from inside a user gesture, and an `await` before
 * `permissions.request()` loses the gesture. So the popup calls `refresh()` when it
 * opens, and `run()` decides without waiting: it calls `request()` in the same
 * turn as the click unless access is already known to be there.
 */
export function createHostAccess(api: PermissionsApi | undefined) {
  /** undefined: not known (the check hasn't answered, or failed). */
  let granted: boolean | undefined;
  let asking = false;

  async function contains(): Promise<boolean | undefined> {
    if (!api) return true; // no permissions API to ask: nothing to gate on
    try {
      return await api.contains(COOK_MD_ACCESS);
    } catch {
      return undefined;
    }
  }

  return {
    /** Look up the current state; call when the popup opens. */
    async refresh(): Promise<void> {
      granted = await contains();
    },

    /**
     * Call synchronously from a click or submit handler. Runs `action` at once when
     * access is known; otherwise asks for it and runs `action` if it is given, or
     * `denied` if not. A click that lands while the prompt is up is ignored.
     */
    run(action: () => void, denied: () => void): void {
      if (granted === true || !api) {
        action();
        return;
      }
      if (asking) return;
      asking = true;

      let asked: Promise<boolean>;
      try {
        asked = api.request(COOK_MD_ACCESS); // no await before this line
      } catch (error) {
        asked = Promise.reject(error);
      }
      asked
        // request() failed rather than answered (e.g. the browser saw no user
        // gesture): fall back on what is granted now, and when even that is
        // unknown let the request go out and succeed or fail on its own.
        .catch(async () => (await contains()) ?? true)
        .then((ok) => {
          granted = ok;
          asking = false;
          if (ok) action();
          else denied();
        });
    },
  };
}

export type HostAccess = ReturnType<typeof createHostAccess>;
