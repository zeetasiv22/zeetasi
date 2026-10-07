import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { appOrigin } from "../src/lib/auth-config";
import { safeRedirect, streamingLinks } from "../src/lib/domain";

const mocks = vi.hoisted(() => ({
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    resend: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    signInWithOAuth: vi.fn(),
  },
  google: vi.fn(),
  ready: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({ auth: mocks.auth }),
  configured: () => true,
  currentUser: vi.fn(),
  accountStoreReady: mocks.ready,
}));
vi.mock("@/lib/auth-providers", () => ({ googleAvailable: mocks.google }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { GET as callback } from "../src/app/auth/callback/route";
import { GET as google } from "../src/app/auth/google/route";
import {
  authenticate,
  forgotPassword,
  resendVerification,
} from "../src/app/actions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.ready.mockResolvedValue(true);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("RENDER_EXTERNAL_URL", "https://zetahub.onrender.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("canonical authentication redirects", () => {
  it("repairs a localhost deployment URL using trusted Render configuration", () => {
    expect(appOrigin()).toBe("https://zetahub.onrender.com");
    expect(
      appOrigin({
        NEXT_PUBLIC_APP_URL: "https://watch.example.com",
        RENDER_EXTERNAL_URL: "https://zetahub.onrender.com",
      }),
    ).toBe("https://watch.example.com");
    expect(appOrigin({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" })).toBe(
      "http://localhost:3000",
    );
    expect(() =>
      appOrigin({ NEXT_PUBLIC_APP_URL: "https://user:pass@example.com" }),
    ).toThrow();
    expect(() =>
      appOrigin({ NEXT_PUBLIC_APP_URL: "https://example.com/path" }),
    ).toThrow();
  });
  it("rejects redirect control characters normalized by URL parsers", () => {
    for (const path of [
      "/\t/evil.example",
      "/\n/evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\u0000evil.example",
    ])
      expect(safeRedirect(path)).toBe("/");
  });
  it("exchanges a callback code and ignores an internal or forged request host", async () => {
    mocks.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await callback(
      new NextRequest(
        "http://localhost:10000/auth/callback?code=synthetic&next=/settings/profile",
        { headers: { "x-forwarded-host": "evil.example" } },
      ),
    );
    expect(mocks.auth.exchangeCodeForSession).toHaveBeenCalledWith("synthetic");
    expect(res.headers.get("location")).toBe(
      "https://zetahub.onrender.com/settings/profile",
    );
  });
  it("does not follow a malicious next URL", async () => {
    mocks.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await callback(
      new NextRequest(
        "http://localhost:10000/auth/callback?code=test&next=" +
          encodeURIComponent("/\t/evil.example"),
      ),
    );
    expect(res.headers.get("location")).toBe("https://zetahub.onrender.com/");
  });
  it("returns expired-code failures to the public login page", async () => {
    mocks.auth.exchangeCodeForSession.mockResolvedValue({
      error: { code: "flow_state_expired" },
    });
    const res = await callback(
      new NextRequest("http://localhost:10000/auth/callback?code=expired"),
    );
    expect(new URL(res.headers.get("location")!).origin).toBe(
      "https://zetahub.onrender.com",
    );
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });
});

describe("Google OAuth boundary", () => {
  it("starts only the configured provider and uses the public PKCE callback", async () => {
    mocks.google.mockResolvedValue(true);
    mocks.auth.signInWithOAuth.mockResolvedValue({
      data: {
        url: "https://project.supabase.co/auth/v1/authorize?provider=google",
      },
      error: null,
    });
    const res = await google();
    expect(mocks.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://zetahub.onrender.com/auth/callback" },
    });
    expect(res.headers.get("location")).toContain("provider=google");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
  it("does not claim a disabled Google provider is usable", async () => {
    mocks.google.mockResolvedValue(false);
    const res = await google();
    expect(mocks.auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/login?error=");
  });
});

function form(mode = "register") {
  const f = new FormData();
  f.set("mode", mode);
  f.set("email", "synthetic@example.test");
  f.set("password", "Synthetic-only-password-123!");
  return f;
}
describe("email flows", () => {
  it("does not create accounts or send verification mail before database installation", async () => {
    mocks.ready.mockResolvedValue(false);
    await expect(authenticate(form())).rejects.toThrow(
      "redirect:/register?error=",
    );
    expect(mocks.auth.signUp).not.toHaveBeenCalled();
  });
  it("sends signup to the public callback and shows verification only when needed", async () => {
    mocks.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    await expect(authenticate(form())).rejects.toThrow(
      "redirect:/verify-email",
    );
    expect(mocks.auth.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(
      "https://zetahub.onrender.com/auth/callback",
    );
    mocks.auth.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    await expect(authenticate(form())).rejects.toThrow("redirect:/");
  });
  it("uses the public callback for password recovery and resending verification", async () => {
    mocks.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.auth.resend.mockResolvedValue({ error: null });
    await expect(forgotPassword(form())).rejects.toThrow(
      "redirect:/forgot-password?success=1",
    );
    expect(mocks.auth.resetPasswordForEmail.mock.calls[0][1].redirectTo).toBe(
      "https://zetahub.onrender.com/auth/callback?next=/reset-password",
    );
    await expect(resendVerification(form())).rejects.toThrow(
      "redirect:/verify-email?success=1",
    );
    expect(mocks.auth.resend.mock.calls[0][0].options.emailRedirectTo).toBe(
      "https://zetahub.onrender.com/auth/callback",
    );
  });
  it("does not report email delivery success when Supabase rejects it", async () => {
    mocks.auth.resetPasswordForEmail.mockResolvedValue({
      error: { code: "over_email_send_rate_limit" },
    });
    await expect(forgotPassword(form())).rejects.toThrow(
      "redirect:/forgot-password?error=",
    );
  });
});

it("displays only enabled HTTPS streaming provider links", () => {
  const links = [
    {
      site: "Provider",
      url: "https://provider.example/title",
      type: "STREAMING",
      isDisabled: false,
    },
    {
      site: "Disabled",
      url: "https://provider.example/removed",
      type: "STREAMING",
      isDisabled: true,
    },
    {
      site: "Social",
      url: "https://social.example",
      type: "SOCIAL",
      isDisabled: false,
    },
    {
      site: "Unsafe",
      url: "javascript:alert(1)",
      type: "STREAMING",
      isDisabled: false,
    },
  ];
  expect(streamingLinks(links)).toEqual([
    { site: "Provider", url: "https://provider.example/title" },
  ]);
});
