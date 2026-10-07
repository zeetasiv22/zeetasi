import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const fixture = vi.hoisted(() => ({
  stored: vi.fn(),
  persist: vi.fn(),
  at: "2026-10-07T12:00:00Z",
}));
vi.mock("@/server/providers/store", () => ({
  storedHealth: fixture.stored,
  persistHealth: fixture.persist,
  persistTitles: vi.fn(),
  persistEpisodes: vi.fn(),
  persistPlayback: vi.fn(),
  playbackExpires: () => Infinity,
  providerStore: () => null,
}));
vi.mock("@/server/providers/provider-registry", () => {
  const adapter = {
    id: "fixture",
    name: "Synthetic fixture",
    host: "fixture.p.rapidapi.com",
    capabilities: ["METADATA"],
    plan: "test only",
    categories: ["movies"],
    search: async () => [{ id: "synthetic-result" }],
  };
  return {
    providerRegistry: [adapter],
    enabledProviders: () => [adapter],
    providerCandidates: [],
  };
});
import { testProvider } from "@/server/providers/engine";
afterEach(() => vi.useRealTimers());
it("retains another worker’s checks when the latest stored and local timestamps are identical", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(fixture.at));
  fixture.stored.mockResolvedValue([
    {
      provider: "fixture",
      name: "Synthetic fixture",
      host: "fixture.p.rapidapi.com",
      status: "healthy",
      enabled: true,
      latency: 1,
      capabilities: ["METADATA"],
      plan: "test only",
      lastTest: new Date(fixture.at).toISOString(),
      rateLimitWarnings: 0,
      checks: {
        search: { pass: true, at: fixture.at, message: "PASS" },
        title: { pass: true, at: fixture.at, message: "PASS" },
      },
    },
  ]);
  const result = await testProvider("fixture", "search", "fixture query");
  expect(result.health?.checks.title?.pass).toBe(true);
  expect(result.health?.checks.search?.pass).toBe(true);
  expect(fixture.persist.mock.calls[0][0].checks).toEqual({
    search: {
      pass: true,
      at: new Date(fixture.at).toISOString(),
      message: "PASS",
    },
  });
});
