import { describe, expect, it, vi } from "vitest";
import { COOK_MD_ACCESS, createHostAccess } from "../lib/host-access";

function fakeApi(contains: boolean | Error, request: boolean | Error = true) {
  const answer = (value: boolean | Error) => (value instanceof Error ? Promise.reject(value) : Promise.resolve(value));
  return {
    contains: vi.fn((_permissions: { origins: string[] }) => answer(contains)),
    request: vi.fn((_permissions: { origins: string[] }) => answer(request)),
  };
}

const callbacks = () => ({ action: vi.fn(), denied: vi.fn() });
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe("host access to cook.md", () => {
  it("runs the action at once, without asking, when access is granted (Chrome, Firefox)", async () => {
    const api = fakeApi(true);
    const access = createHostAccess(api);
    const { action, denied } = callbacks();

    await access.refresh();
    access.run(action, denied);

    expect(action).toHaveBeenCalledTimes(1); // synchronously: nothing was awaited
    expect(api.contains).toHaveBeenCalledWith(COOK_MD_ACCESS);
    expect(api.request).not.toHaveBeenCalled();
    expect(denied).not.toHaveBeenCalled();
  });

  it("asks in the same turn as the click when access is missing, then runs the action", async () => {
    const api = fakeApi(false, true);
    const access = createHostAccess(api);
    const { action, denied } = callbacks();

    await access.refresh();
    access.run(action, denied);

    expect(api.request).toHaveBeenCalledWith(COOK_MD_ACCESS); // before any await
    expect(action).not.toHaveBeenCalled();
    await settle();
    expect(action).toHaveBeenCalledTimes(1);
    expect(denied).not.toHaveBeenCalled();
  });

  it("does not ask again once access was given", async () => {
    const api = fakeApi(false, true);
    const access = createHostAccess(api);
    await access.refresh();
    access.run(vi.fn(), vi.fn());
    await settle();

    const { action } = callbacks();
    access.run(action, vi.fn());

    expect(action).toHaveBeenCalledTimes(1);
    expect(api.request).toHaveBeenCalledTimes(1);
  });

  it("reports a refusal and asks again on the next click", async () => {
    const api = fakeApi(false, false);
    const access = createHostAccess(api);
    const { action, denied } = callbacks();

    await access.refresh();
    access.run(action, denied);
    await settle();

    expect(action).not.toHaveBeenCalled();
    expect(denied).toHaveBeenCalledTimes(1);

    access.run(action, denied);
    await settle();
    expect(api.request).toHaveBeenCalledTimes(2);
    expect(denied).toHaveBeenCalledTimes(2);
  });

  it("asks when the state is not known yet; a browser that has it granted answers true without a prompt", async () => {
    const api = fakeApi(true, true);
    const access = createHostAccess(api);
    const { action, denied } = callbacks();

    access.run(action, denied); // refresh() never ran
    expect(api.request).toHaveBeenCalledTimes(1);
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect(denied).not.toHaveBeenCalled();
  });

  it("ignores a second click while the prompt is up", async () => {
    const api = fakeApi(false, true);
    const access = createHostAccess(api);
    const { action, denied } = callbacks();
    await access.refresh();

    access.run(action, denied);
    access.run(action, denied);
    await settle();

    expect(api.request).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("when request() fails, goes by what is granted now", async () => {
    const granted = fakeApi(true, new Error("must be called during a user gesture"));
    const first = callbacks();
    createHostAccess(granted).run(first.action, first.denied);
    await settle();
    expect(first.action).toHaveBeenCalledTimes(1);

    const missing = fakeApi(false, new Error("must be called during a user gesture"));
    const second = callbacks();
    createHostAccess(missing).run(second.action, second.denied);
    await settle();
    expect(second.action).not.toHaveBeenCalled();
    expect(second.denied).toHaveBeenCalledTimes(1);
  });

  it("when request() throws synchronously, goes by what is granted now", async () => {
    const api = fakeApi(false);
    api.request.mockImplementation(() => {
      throw new Error("bad call");
    });
    const { action, denied } = callbacks();
    createHostAccess(api).run(action, denied);
    await settle();
    expect(denied).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();
  });

  it("lets the request go out when nothing can be found out", async () => {
    const api = fakeApi(new Error("broken"), new Error("broken"));
    const access = createHostAccess(api);
    const { action, denied } = callbacks();

    await access.refresh();
    access.run(action, denied);
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect(denied).not.toHaveBeenCalled();
  });

  it("never gates where there is no permissions API", async () => {
    const access = createHostAccess(undefined);
    const { action, denied } = callbacks();
    await access.refresh();
    access.run(action, denied);
    expect(action).toHaveBeenCalledTimes(1);
  });
});
