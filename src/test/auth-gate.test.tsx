import { describe, expect, it, vi } from "vitest";

const getUser = vi.fn();

// The gate is what decides who gets to see /chat, so test it without loading
// the whole app shell it renders for signed-in people.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: () => getUser() } },
}));
vi.mock("@/components/shell/AppShell", () => ({ AppShell: () => null }));

const gate = () => import("@/routes/_authenticated/route");

async function guard(path: string) {
  const { Route } = await gate();
  const beforeLoad = Route.options.beforeLoad as (a: unknown) => Promise<unknown>;
  try {
    await beforeLoad({ location: { href: path } });
    return { redirected: false as const };
  } catch (error) {
    const redirect = error as { options?: { to?: string } };
    return { redirected: true as const, to: redirect?.options?.to };
  }
}

describe("Sign-in gate", () => {
  it("sends a signed-out visitor opening /chat to the sign-in page", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await guard("/chat");

    expect(result).toEqual({ redirected: true, to: "/auth" });
  });

  it("lets someone who is signed in through to /chat", async () => {
    const user = { id: "u1", email: "someone@example.com" };
    getUser.mockResolvedValue({ data: { user }, error: null });

    const result = await guard("/chat");

    expect(result).toEqual({ redirected: false });
  });
});
