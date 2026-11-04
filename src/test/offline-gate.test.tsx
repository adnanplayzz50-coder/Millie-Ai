import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const getSession = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: () => getUser(), getSession: () => getSession() } },
}));
vi.mock("@/components/shell/AppShell", () => ({ AppShell: () => null }));

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}
function saveLogin() {
  localStorage.setItem("sb-abc-auth-token", JSON.stringify({ access_token: "x", refresh_token: "y", user: { id: "u1" } }));
}

async function run(importer: () => Promise<{ Route: { options: { beforeLoad?: unknown } } }>) {
  const { Route } = await importer();
  const beforeLoad = Route.options.beforeLoad as (a: unknown) => Promise<unknown>;
  try {
    await beforeLoad({ location: { href: "/" } });
    return { to: "stayed" };
  } catch (e) {
    return { to: (e as { options?: { to?: string } }).options?.to };
  }
}
const chatGate = () => import("@/routes/_authenticated/route");
const home = () => import("@/routes/index");

beforeEach(() => {
  localStorage.clear();
  getUser.mockReset();
  getSession.mockReset();
});
afterEach(() => setOnline(true));

describe("Offline with a saved sign-in", () => {
  it("lets /chat open", async () => {
    setOnline(false);
    saveLogin();
    expect(await run(chatGate)).toEqual({ to: "stayed" });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("sends the home page to /chat, not the sign-in page", async () => {
    setOnline(false);
    saveLogin();
    getSession.mockResolvedValue({ data: { session: null }, error: new Error("offline") });
    expect(await run(home)).toEqual({ to: "/chat" });
  });
});

describe("Offline with no saved sign-in", () => {
  it("sends /chat and the home page to sign in", async () => {
    setOnline(false);
    expect(await run(chatGate)).toEqual({ to: "/auth" });
    expect(await run(home)).toEqual({ to: "/auth" });
  });
});

describe("Wi-Fi connected but the internet is down", () => {
  it("keeps a saved sign-in when the refresh fails with a network error", async () => {
    saveLogin();
    const err = Object.assign(new Error("fetch failed"), { name: "AuthRetryableFetchError" });
    getUser.mockResolvedValue({ data: { user: null }, error: err });
    getSession.mockResolvedValue({ data: { session: null }, error: err });
    expect(await run(chatGate)).toEqual({ to: "stayed" });
    expect(await run(home)).toEqual({ to: "/chat" });
  });
});

describe("Online", () => {
  it("still sends a really signed-out person to sign in", async () => {
    saveLogin(); // a leftover login must not count once the server says there is no session
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await run(chatGate)).toEqual({ to: "/auth" });
    expect(await run(home)).toEqual({ to: "/auth" });
  });
});
